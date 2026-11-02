"""Independent running-comparison oracle (shares no code with the app).
Usage: python3 -I oracle_running.py Activities.csv 2026-11-02 > tests/fixtures/oracle-running.json
Periods: the four most recent complete Mon-Sun weeks before TODAY, those four combined, and the most
recent complete calendar month before TODAY. Outdoor = 'Running'; treadmill = 'Treadmill Running'.
Pace = distance-weighted mean of the exported m:ss Avg Pace (seconds/km), over runs that have BOTH a
parseable m:ss pace and a distance > 0. Km = sum of Distance over runs with a numeric distance."""
import csv, json, sys
from datetime import date, timedelta
path, today_s = sys.argv[1], sys.argv[2]
today = date.fromisoformat(today_s)
rows = list(csv.DictReader(open(path, encoding='utf-8-sig', newline='')))
def num(s):
    s = s.replace(',', '')
    return None if s in ('', '--') else float(s)
def pace(s):
    if ':' not in s: return None
    m, x = s.split(':'); return int(m) * 60 + int(x)
runs = []
for r in rows:
    t = r['Activity Type']
    if t not in ('Running', 'Treadmill Running'): continue
    runs.append({'date': r['Date'][:10], 'kind': 'outdoor' if t == 'Running' else 'treadmill',
                 'km': num(r['Distance']), 'pace': pace(r['Avg Pace'])})
def period(start, end, kinds):
    sel = [r for r in runs if start <= r['date'] <= end and r['kind'] in kinds]
    kms = [r['km'] for r in sel if r['km'] is not None]
    pw = [r for r in sel if r['pace'] is not None and r['km'] is not None and r['km'] > 0]
    dist = sum(r['km'] for r in pw)
    return {'start': start, 'end': end, 'runs': len(sel), 'runs_with_pace': len(pw),
            'km': round(sum(kms), 2) if kms else None,
            'pace_sec_per_km': round(sum(r['pace'] * r['km'] for r in pw) / dist, 2) if dist > 0 else None}
last_mon = today - timedelta(days=today.weekday()) - timedelta(days=7)
weeks = [(last_mon - timedelta(days=7 * i)) for i in (3, 2, 1, 0)]
first_of_this_month = today.replace(day=1)
last_month_end = first_of_this_month - timedelta(days=1)
month_start = last_month_end.replace(day=1)
out = {'today': today_s, 'month_label': last_month_end.strftime('%Y-%m')}
for name, kinds in (('outdoor_only', ('outdoor',)), ('outdoor_plus_treadmill', ('outdoor', 'treadmill'))):
    out[name] = {
        'weeks': [period(w.isoformat(), (w + timedelta(days=6)).isoformat(), kinds) for w in weeks],
        'four_weeks': period(weeks[0].isoformat(), (weeks[-1] + timedelta(days=6)).isoformat(), kinds),
        'month': period(month_start.isoformat(), last_month_end.isoformat(), kinds),
    }
print(json.dumps(out, indent=2))
