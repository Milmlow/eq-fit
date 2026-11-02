"""Decrypt a Garmin EQ Fit encrypted export on your own machine.

No Garmin credentials required. The passphrase is prompted locally and never
sent to GitHub or written to a log. Keep the resulting CSV private.
"""
from __future__ import annotations

import argparse
import getpass
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

MAGIC = b"EQFITG1!"
ITERATIONS = 600_000


def decrypt(blob: bytes, password: str) -> bytes:
    if not blob.startswith(MAGIC) or len(blob) < len(MAGIC) + 16 + 12 + 16:
        raise ValueError("This is not a supported EQ Fit encrypted export.")
    pos = len(MAGIC)
    salt = blob[pos:pos + 16]
    nonce = blob[pos + 16:pos + 28]
    ciphertext = blob[pos + 28:]
    key = PBKDF2HMAC(
        algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS
    ).derive(password.encode("utf-8"))
    return AESGCM(key).decrypt(nonce, ciphertext, MAGIC)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("encrypted_file", type=Path)
    parser.add_argument("--output", type=Path, default=Path("garmin-runs.csv"))
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output already exists: refusing to overwrite it.")
    pwd = getpass.getpass("EQ Fit export passphrase (not Garmin key): ")
    try:
        plain = decrypt(args.encrypted_file.read_bytes(), pwd)
    except (ValueError, Exception):
        parser.error("Cannot decrypt: check your passphrase and file.")
    args.output.write_bytes(plain)
    print("Decrypted CSV saved locally. Keep it private. Import via EQ Fit > More > Import.")


if __name__ == "__main__":
    main()
