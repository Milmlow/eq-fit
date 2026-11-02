"""Independent running-bests oracle for the REAL export (shares no code with the app; reads the CSV directly).
Usage: python3 -I tests/oracle/oracle_push_real.py data-local/Activities.csv data-local/oracle-push-real.json
The output stays in data-local/ (gitignored): it holds dates and results from the real file, which must not be committed.
Outdoor = Activity Type 'Running' (the app's default mapping). A run is valid only with Distance > 0 and a m:ss Avg Pace > 0.
"""
import csv, json, sys, math
from datetime import date, timedelta
from fractions import Fraction

src, dst = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(open(src, encoding='utf-8-sig', newline='')))


def num(s):
    s = s.replace(',', '').strip()
    return None if s in ('', '--') else Fraction(s)


def pace(s):
    if ':' not in s:
        return None
    m, x = s.split(':')
    return int(m) * 60 + int(x)


runs = []
for r in rows:
    if r['Activity Type'] != 'Running':
        continue
    km, p = num(r['Distance']), pace(r['Avg Pace'])
    if km is None or km <= 0 or p is None or p <= 0:
        continue
    runs.append((r['Date'][:10], km, p))


def monday(s):
    d = date.fromisoformat(s)
    return (d - timedelta(days=d.weekday())).isoformat()


def r2(fr):
    return math.floor(fr * 100 + Fraction(1, 2)) / 100


def fastest(minkm):
    pool = [x for x in runs if x[1] >= minkm]
    if not pool:
        return {'value': None, 'date': None, 'n': 0}
    best = min(p for _, _, p in pool)
    return {'value': best, 'date': min(d for d, _, p in pool if p == best), 'n': len(pool)}


longest = max(k for _, k, _ in runs)
weeks = {}
for d, k, _ in runs:
    weeks.setdefault(monday(d), []).append(k)
tot = {w: sum(v) for w, v in weeks.items()}
bw = max(tot.values())
bwk = min(w for w, t in tot.items() if t == bw)
out = {'bests': {
    'fastest5k': fastest(5), 'fastest10k': fastest(10),
    'longest': {'value': r2(longest), 'date': min(d for d, k, _ in runs if k == longest), 'n': len(runs)},
    'bestWeek': {'value': r2(bw), 'date': bwk, 'n': len(weeks), 'runsInWeek': len(weeks[bwk])},
}}
json.dump(out, open(dst, 'w'), indent=1)
print(json.dumps(out))
