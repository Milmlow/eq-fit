"""Scheduled Garmin -> private Supabase. No activity files, logs or public artifacts."""
from __future__ import annotations
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlparse, quote
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
            row = to_row(item, training=True)
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


INGEST_URL = 'https://hihqnnxnlkjfbixhcgaa.supabase.co/functions/v1/garmin-ingest'


class PrivateStore:
    # Workload identity avoids distributing any Supabase privileged key to GitHub.
    def __init__(self, url=INGEST_URL):
        if url != INGEST_URL:
            raise ValueError('Unexpected private sync destination')
        self.url = url

    def request(self, action, **fields):
        identity_url = os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']
        parsed = urlparse(identity_url)
        if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.actions.githubusercontent.com'):
            raise ValueError('Unexpected GitHub identity provider')
        identity_req = Request(identity_url + '&audience=' + quote(self.url, safe=''), headers={
            'Authorization': 'Bearer ' + os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
        def identity():
            with urlopen(identity_req, timeout=30) as response:
                return json.load(response)['value']
        token = retry(identity)
        req = Request(self.url, data=json.dumps(dict(action=action, **fields)).encode(), headers={
            'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        def call():
            with urlopen(req, timeout=45) as response:
                return json.load(response)
        return retry(call)


def main():
    store = None
    stage = 'configuration'
    try:
        key = os.environ['GARMIN_PERSONAL_API_KEY']
        store = PrivateStore()
        stage = 'private-store-authentication'
        state = store.request('state')['state']
        now = datetime.now(timezone.utc)
        start, end, full = sync_window(state, now)
        from garmin_personal_api import GarminPersonalApiClient, PersonalApiAuthenticator
        stage = 'garmin-authentication'
        with PersonalApiAuthenticator(timeout=30) as auth:
            token = retry(lambda: auth.obtain_token(key))
        stage = 'garmin-download'
        with GarminPersonalApiClient(token.access_token, timeout=30) as client:
            rows = gather(client, start, end)
        stage = 'private-store-write'
        store.request('commit', rows=rows, full=full)
        print('Private Garmin sync completed. No activity data was logged.')
        return 0
    except Exception as exc:
        status = getattr(exc, 'code', None) or getattr(exc, 'status_code', None)
        print(f'Sync stage failed: {stage}; error type: {type(exc).__name__}; HTTP status: {status if isinstance(status, int) else "none"}.', file=sys.stderr)
        if store:
            try:
                store.request('failed')
            except Exception:
                pass
        print('Private Garmin sync failed. Check configuration or service availability. Cached history is retained.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
