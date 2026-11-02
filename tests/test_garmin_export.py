"""Offline unit tests. No Garmin API calls or real personal activity data."""
from __future__ import annotations

import csv
import io
import unittest

from scripts.export_garmin_encrypted import HEADERS, csv_bytes, encrypt, gather_runs, to_row
from scripts.decrypt_garmin_export import decrypt


class GarminExportTests(unittest.TestCase):
    def test_running_row(self):
        row = to_row({
            "activityId": 123,
            "activityType": {"typeKey": "running"},
            "startTimeLocal": "2026-11-03 06:00:00",
            "activityName": "Morning run",
            "distance": 5000.0,
            "duration": 1500.0,
            "averageSpeed": 3.3333333333,
        })
        self.assertEqual(row, ["Running", "2026-11-03 06:00:00", "Morning run", "5.0000", "00:25:00", "5:00", "123"])

    def test_treadmill(self):
        row = to_row({
            "activityId": 321,
            "activityType": {"typeKey": "treadmill_running"},
            "startTimeLocal": "2026-11-03 06:00:00",
            "distance": 2000.0,
        })
        self.assertEqual(row[0], "Treadmill Running")
        self.assertEqual(row[5], "")

    def test_missing_distance_and_speed_are_not_zero(self):
        row = to_row({
            "activityId": 11,
            "activityType": {"typeKey": "running"},
            "startTimeLocal": "2026-11-03 06:00:00",
        })
        self.assertEqual(row[3], "")
        self.assertEqual(row[5], "")

    def test_other_sports_excluded(self):
        self.assertIsNone(to_row({"activityType": {"typeKey": "cycling"}}))

    def test_invalid_date_rejected(self):
        with self.assertRaises(ValueError):
            to_row({
                "activityId": 11, "activityType": {"typeKey": "running"},
                "startTimeLocal": "2026-02-31 06:00:00",
            })

    def test_pagination_dedupes_id(self):
        class Fake:
            def search_activities(self, **kwargs):
                return [
                    {"activityId": 44, "activityType": {"typeKey": "running"},
                     "startTimeLocal": "2026-11-03 06:00:00"},
                    {"activityId": 44, "activityType": {"typeKey": "running"},
                     "startTimeLocal": "2026-11-03 06:00:00"},
                ]
        self.assertEqual(len(gather_runs(Fake(), "2026-11-01", "2026-11-04")), 1)

    def test_encryption_round_trip(self):
        raw = csv_bytes([["Running", "2026-11-03 06:00:00", "Test run", "5", "00:30:00", "6:00", "19"]])
        packed = encrypt(raw, "safe passphrase for private training")
        self.assertNotIn(b"Test run", packed)
        self.assertEqual(decrypt(packed, "safe passphrase for private training"), raw)
        data = list(csv.reader(io.StringIO(raw.decode())))
        self.assertEqual(data[0], HEADERS)
        self.assertEqual(data[1][3], "5")

    def test_wrong_passphrase_rejected(self):
        packed = encrypt(b"private", "right longer passphrase")
        with self.assertRaises(Exception):
            decrypt(packed, "wrong longer passphrase")


if __name__ == "__main__":
    unittest.main()
