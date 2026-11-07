import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone
from urllib.error import HTTPError
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from sync_garmin_private import retry, sync_window, gather, PrivateStore


class SyncTests(unittest.TestCase):
    def test_initial_and_weekly_full_refresh(self):
        now = datetime(2026, 11, 3, tzinfo=timezone.utc)
        self.assertEqual(sync_window(None, now), ('2000-01-01', '2026-11-04', True))
        self.assertFalse(sync_window({'last_full_sync': '2026-11-02T00:00:00Z', 'last_success': '2026-11-02T00:00:00Z'}, now)[2])
        self.assertTrue(sync_window({'last_full_sync': '2026-10-20T00:00:00Z'}, now)[2])

    def test_recovers_long_outage_without_cursor_gap(self):
        now = datetime(2026, 11, 3, tzinfo=timezone.utc)
        start, _, full = sync_window({'last_full_sync': '2026-11-02T00:00:00Z', 'last_success': '2026-07-01T00:00:00Z'}, now)
        self.assertEqual(start, '2026-06-29')
        self.assertFalse(full)

    def test_retries_transient_errors_with_bound(self):
        calls, delays = [], []
        def fail():
            calls.append(1)
            raise HTTPError('https://example.invalid', 503, 'unavailable', None, None)
        with self.assertRaises(HTTPError): retry(fail, delays.append)
        self.assertEqual(len(calls), 4); self.assertEqual(delays, [1, 2, 4])

    def test_no_retry_for_revoked_key(self):
        calls = []
        def fail():
            calls.append(1)
            raise HTTPError('https://example.invalid', 401, 'unauthorized', None, None)
        with self.assertRaises(HTTPError): retry(fail, lambda _: None)
        self.assertEqual(len(calls), 1)

    def test_garmin_client_status_and_requests_timeout_retry(self):
        from requests.exceptions import Timeout
        class GarminHttpError(Exception):
            status_code = 429
        errors = [GarminHttpError(), Timeout()]
        delays = []
        def call():
            if errors: raise errors.pop(0)
            return 'ok'
        self.assertEqual(retry(call, delays.append), 'ok')
        self.assertEqual(delays, [1, 2])

    def test_normalizes_training_and_missing_hr(self):
        class Client:
            def search_activities(self, **kwargs):
                return [dict(activityType={'typeKey': 'trail_running'}, activityId=123, startTimeLocal='2026-11-03T04:00:00', distance=5000, duration=1800, averageSpeed=2.5), dict(activityType={'typeKey':'walking'},activityId=124,startTimeLocal='2026-11-03T08:00:00',duration=1200,averageSpeed=1.2),dict(activityType={'typeKey':'strength_training'},activityId=125,startTimeLocal='2026-11-03T09:00:00',duration=1800)]
        rows = gather(Client(), '2026-11-01', '2026-11-04')
        self.assertEqual(len(rows), 3); self.assertEqual(rows[0][3], '5.0000'); self.assertEqual(rows[0][5], '6:40'); self.assertEqual(rows[0][-1], '')
        self.assertEqual(rows[1][0], 'Walking'); self.assertEqual(rows[1][5], '')
        self.assertEqual(rows[2][0], 'Strength Training'); self.assertEqual(rows[2][3], '')

    def test_invalid_response_is_not_an_empty_success(self):
        class Client:
            def search_activities(self, **kwargs): return {'error': 'failed'}
        with self.assertRaises(ValueError): gather(Client(), '2026-11-01', '2026-11-04')

    def test_restricts_destination_before_sending_secret(self):
        for url in ['http://x.supabase.co', 'https://evil.example', 'https://x.supabase.co.evil.example', 'https://x.supabase.co/?leak=1']:
            with self.assertRaises(ValueError): PrivateStore(url)


if __name__ == '__main__': unittest.main()
