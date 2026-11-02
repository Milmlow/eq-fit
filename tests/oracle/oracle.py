"""Independent oracle: computes expected recent-window figures straight from Activities.csv.
Standalone; shares no code with the app parser. Usage: python3 -I oracle.py Activities.csv > oracle.json"""
import csv, json, sys, hashlib
from datetime import date, timedelta
path = sys.argv[1]
raw = open(path, 'rb').read()
rows = list(csv.DictReader(raw.decode('utf-8-sig').splitlines(True)))
def grp(t):
    if t in ('Cardio', 'Strength Training'): return 'weights'
    if t == 'Running': return 'outdoor'
    if t == 'Treadmill Running': return 'treadmill'
    return None
def secs(s):
    h, m, x = s.split(':'); return int(h)*3600 + int(m)*60 + float(x)
def num(s):
    s = s.replace(',', '')
    return None if s in ('', '--') else float(s)
def summarise(start, end):
    out = {g: {'entries': 0, 'days': set(), 'km': 0.0, 'seconds': 0.0} for g in ('weights', 'outdoor', 'treadmill')}
    active = set()
    for r in rows:
        d = r['Date'][:10]
        if not (start <= d <= end): continue
        active.add(d)
        g = grp(r['Activity Type'])
        if g:
            o = out[g]; o['entries'] += 1; o['days'].add(d)
            o['km'] += num(r['Distance']) or 0.0
            o['seconds'] += secs(r['Time'])
    res = {g: {'entries': o['entries'], 'distinct_days': len(o['days']), 'km': round(o['km'], 2), 'minutes': round(o['seconds']/60, 2)} for g, o in out.items()}
    res['active_dates'] = len(active)
    res['active_dates_by_group_only'] = len({d for g in out for d in out[g]['days']})
    return res
res = {
 'file_sha256': hashlib.sha256(raw).hexdigest(),
 'data_rows': len(rows), 'columns': len(rows[0]),
 'latest_timestamp': max(r['Date'] for r in rows),
 'window': {'start': '2026-10-05', 'end': '2026-11-01', **summarise('2026-10-05', '2026-11-01')},
 'last_full_week': {'start': '2026-10-26', 'end': '2026-11-01', **summarise('2026-10-26', '2026-11-01')},
 'active_date_definition': 'a date with at least one activity of any type',
}
print(json.dumps(res, indent=2))
