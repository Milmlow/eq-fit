"""Fetch Garmin runs, encrypt before writing any activity file.

The repository is public. Never log records or upload an unencrypted activity
file as a public Actions artifact. Output is AES-256-GCM encrypted with an
independent user passphrase, not the Garmin API key.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import secrets
import sys
from datetime import date, timedelta
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

MAGIC = b"EQFITG1!"
ITERATIONS = 600_000
HEADERS = ["Activity Type", "Date", "Title", "Distance", "Time", "Avg Pace", "Garmin Activity ID"]
TYPE_MAP = {
    "running": "Running",
    "trail_running": "Running",
    "track_running": "Running",
    "ultra_run": "Running",
    "treadmill_running": "Treadmill Running",
    "indoor_running": "Treadmill Running",
}
LOCAL_TIME = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")


def to_row(item: object) -> list[str] | None:
    """Normalise a Garmin summary. Reject invalid timestamps, do not invent pace."""
    if not isinstance(item, dict):
        return None
    category = item.get("activityType")
    type_key = category.get("typeKey") if isinstance(category, dict) else category
    activity_type = TYPE_MAP.get(str(type_key or "").lower())
    if activity_type is None:
        return None
    id_value = str(item.get("activityId", ""))
    if not id_value.isdecimal() or int(id_value) <= 0:
        raise ValueError("A Garmin running activity has no usable activityId.")
    timestamp = str(item.get("startTimeLocal", "")).replace("T", " ")[:19]
    if not LOCAL_TIME.fullmatch(timestamp):
        raise ValueError("A Garmin running activity has no usable local start time.")
    try:
        from datetime import datetime
        datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")
    except ValueError as exc:
        raise ValueError("A Garmin running activity has an invalid local start time.") from exc

    def positive(key: str) -> float | None:
        value = item.get(key)
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Invalid numeric field from Garmin.")
        from math import isfinite
        if not isfinite(value) or value < 0:
            raise ValueError("Invalid numeric field from Garmin.")
        return float(value)

    distance_m = positive("distance")
    duration_s = positive("duration")
    speed = positive("averageSpeed")
    if distance_m is not None and distance_m > 2_000_000:
        raise ValueError("Implausible Garmin distance; refusing export.")
    if duration_s is not None and duration_s > 604_800:
        raise ValueError("Implausible Garmin duration; refusing export.")
    if speed is not None and speed > 25:
        raise ValueError("Implausible Garmin average speed; refusing export.")

    distance = "" if distance_m is None else f"{distance_m / 1000:.4f}"
    if duration_s is None:
        duration = ""
    else:
        total = round(duration_s)
        duration = f"{total // 3600:02d}:{total // 60 % 60:02d}:{total % 60:02d}"
    pace = ""
    if speed and speed > 0:
        seconds = round(1000 / speed)
        # Pace may genuinely be unavailable or out of sensible bounds.
        if 60 <= seconds <= 3600:
            pace = f"{seconds // 60}:{seconds % 60:02d}"
    name = str(item.get("activityName") or "Garmin run").replace("\\x00", "")[:120]
    return [activity_type, timestamp, name, distance, duration, pace, id_value]


def gather_runs(client, start_date: str, end_date: str) -> list[list[str]]:
    offset = 0
    by_id: dict[str, list[str]] = {}
    for _ in range(150):
        page = client.search_activities(start=offset, limit=100, start_date=start_date, end_date=end_date)
        if not isinstance(page, list):
            raise RuntimeError("Unexpected Garmin activities API response.")
        for activity in page:
            row = to_row(activity)
            if row is not None:
                by_id[row[-1]] = row
        if len(page) < 100:
            return sorted(by_id.values(), key=lambda row: (row[1], row[-1]))
        offset += len(page)
    raise RuntimeError("Garmin pagination limit reached; narrow the date range.")


def csv_bytes(rows: list[list[str]]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(HEADERS)
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def encrypt(plaintext: bytes, passphrase: str) -> bytes:
    if len(passphrase) < 16:
        raise ValueError("Export passphrase must be at least 16 characters.")
    salt, nonce = secrets.token_bytes(16), secrets.token_bytes(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(passphrase.encode("utf-8"))
    return MAGIC + salt + nonce + AESGCM(key).encrypt(nonce, plaintext, MAGIC)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--output", type=Path, default=Path("data-local/garmin-runs.eqfit"))
    args = parser.parse_args()
    key = os.getenv("GARMIN_PERSONAL_API_KEY", "").strip()
    passphrase = os.getenv("EQFIT_EXPORT_PASSPHRASE", "")
    if not key:
        print("ERROR: Missing GARMIN_PERSONAL_API_KEY Actions secret.", file=sys.stderr)
        return 2
    if len(passphrase) < 16:
        print("ERROR: Set EQFIT_EXPORT_PASSPHRASE as an Actions SECRET (16+ characters).", file=sys.stderr)
        return 2
    if not 1 <= args.days <= 365:
        print("ERROR: days must be in 1..365.", file=sys.stderr)
        return 2
    try:
        from garmin_personal_api import GarminPersonalApiClient, PersonalApiAuthenticator
        utc_today = date.today()
        start = (utc_today - timedelta(days=args.days - 1)).isoformat()
        end = (utc_today + timedelta(days=1)).isoformat()  # cross TZ/local-date rollover
        with PersonalApiAuthenticator(timeout=30) as auth:
            token = auth.obtain_token(key)
        with GarminPersonalApiClient(token.access_token, timeout=30) as client:
            rows = gather_runs(client, start, end)
        # In-memory plaintext only. Only encrypted bytes are written to disk.
        ciphertext = encrypt(csv_bytes(rows), passphrase)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(ciphertext)
        print("SUCCESS: Encrypted Garmin running export generated. No personal activity data was printed.")
    except Exception:
        # Never print Garmin HTTP responses or tracebacks into public CI logs.
        print("ERROR: Garmin download/encryption failed. Nothing was published.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
