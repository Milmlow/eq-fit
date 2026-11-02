"""Scheduled Garmin -> private Supabase. No activity files, logs or public artifacts."""
from __future__ import annotations
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from uuid import UUID
from requests.exceptions import Timeout as RequestsTimeout, ConnectionError as RequestsConnectionError
from export_garmin_encrypted import to_row


def retry(call, sleep=time.sleep):
    for attempt in range(4):
        try:
            return call()
        except Exception as exc:
            status = getattr(exc, 'code', None) or getattr(exc, 'status_code', None) or getattr(getattr(exc, 'response', None), 'status_code', None)
            transient = isinstance(exc, (TimeoutError, ConnectionError, URLError, RequestsTimeout, RequestsConnectionError)) and not isinstance(exc, HTTPError)
            if attempt == 3 or not (transient or status == 429 or (isinstance(status, int) and status >= 500)):
                raise
            sleep(2 ** attempt)


def sync_window(state, now):
    """Weekly full audit captures older edits; ordinary polls overlap the last 35 days."""
    full_at = state.get('last_full_sync') if state else None
    full = not full_at or now - datetime.fromisoformat(full_at.replace('Z', '+00:00')) >= timedelta(days=7)
    success = state.get('last_success') if state else None
    start = now - timedelta(days=35)
    if success:
        start = min(start, datetime.fromisoformat(success.replace('Z', '+00:00')) - timedelta(days=2))
    return ('2000-01-01' if full else start.date().isoformat(), (now + timedelta(days=1)).date().isoformat(), full)


def gather(client, start, end):
    rows = {}
    for offset in range(0, 15000, 100):
        page = retry(lambda: client.search_activities(start=offset, limit=100, start_date=start, end_date=end))
        if not isinstance(page, list):
            raise ValueError('Invalid activity response')
        for item in page:
            row = to_row(item)
            if row is None:
                continue
            hr = item.get('averageHR')
            if hr is not None:
                if isinstance(hr, bool) or not isinstance(hr, (int, float)) or not 0 < hr <= 300:
                    raise ValueError('Invalid heart rate')
            rows[row[6]] = row + ['' if hr is None else str(hr)]
        if len(page) < 100:
            return list(rows.values())
    raise ValueError('Pagination incomplete; cursor not advanced')


class PrivateStore:
    def __init__(self, url, key):
        parsed = urlparse(url)
        if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.supabase.co') or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
            raise ValueError('Expected a hosted Supabase project URL')
        self.url, self.key = url.rstrip('/'), key

    def request(self, path, body=None, prefer=None):
        headers = {'apikey': self.key, 'Authorization': f'Bearer {self.key}', 'Content-Type': 'application/json'}
        if prefer:
            headers['Prefer'] = prefer
        req = Request(self.url + '/rest/v1/' + path, headers=headers, data=None if body is None else json.dumps(body).encode())
        def call():
            with urlopen(req, timeout=45) as response:
                data = response.read()
                return json.loads(data) if data else None
        return retry(call)


def main():
    store, owner = None, None
    try:
        key = os.environ['GARMIN_PERSONAL_API_KEY']
        owner = str(UUID(os.environ['EQFIT_OWNER_ID']))
        store = PrivateStore(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
        states = store.request(f'eqfit_sync_state?owner_id=eq.{owner}&select=last_success,last_full_sync')
        now = datetime.now(timezone.utc)
        start, end, full = sync_window(states[0] if states else None, now)
        from garmin_personal_api import GarminPersonalApiClient, PersonalApiAuthenticator
        with PersonalApiAuthenticator(timeout=30) as auth:
            token = retry(lambda: auth.obtain_token(key))
        with GarminPersonalApiClient(token.access_token, timeout=30) as client:
            rows = gather(client, start, end)
        store.request('rpc/eqfit_commit_sync', {'p_owner': owner, 'p_rows': rows, 'p_full': full})
        print('Private Garmin sync completed. No activity data was logged.')
        return 0
    except Exception:
        if store and owner:
            try:
                store.request('rpc/eqfit_fail_sync', {'p_owner': owner})
            except Exception:
                pass
        print('Private Garmin sync failed. Check configuration or service availability. Cached history is retained.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
