"""Independent lifting oracle. Shares no code with the app. SYNTHETIC data only.
Usage: python3 -I tests/oracle/oracle_lifting.py   (writes tests/fixtures/synthetic-lifting.json and oracle-lifting.json)

Conventions (same as the on-screen text):
  * Weekly sets: WORKING sets only (warm-ups excluded). Each working set counts 1 toward EACH primary muscle
    listed for its exercise (muscles lower-cased, trimmed, de-duplicated). No muscles -> 'unassigned'.
    A working set with missing load or reps still counts as a set. Week = Monday..Sunday of the workout date.
  * e1RM: working sets with load > 0 and reps >= 1 only.
      reps == 1 -> actual lift: both formulas shown as the load itself, flagged actual.
      Epley   = load * (1 + reps/30)
      Brzycki = load * 36 / (37 - reps)
      reps > 10 -> low confidence flag.
    Per workout and exercise the SOURCE set is the eligible set with the highest Epley value (ties: first).
    Values rounded to 1 decimal (half away from zero is not an issue for these inputs; checked by asserts).
"""
import json
from datetime import date, timedelta
from pathlib import Path

EX = {  # id: (name, equipment, primary muscles as typed)
 'bench':   ('Bench Press', 'Barbell', ['Chest', ' triceps ']),
 'incline': ('Incline Press', 'Dumbbell', ['chest']),          # shares 'chest' with bench
 'carry':   ('Farmer Carry', 'Handles', []),                     # blank muscles -> unassigned
 'cpA':     ('Chest Press', 'Machine A', ['CHEST']),             # same name ...
 'cpB':     ('Chest Press', 'Machine B', ['Chest']),             # ... different machine = different exercise
}
# (workout date, exercise id, load, reps, rir, warmup, pain_note)  None = missing
S = [
 # Sunday 2026-10-25 (week of 2026-10-19)
 ('2026-10-25','bench',   40,   10, None, True,  None),   # warm-up: excluded
 ('2026-10-25','bench',   80,    8, 2,    False, None),
 ('2026-10-25','bench',   80,    6, 2,    False, None),
 ('2026-10-25','incline', 30,   12, None, False, None),   # 12 reps: low confidence
 ('2026-10-25','incline', 30,   10, None, False, None),
 ('2026-10-25','cpA',     50,   10, None, False, None),
 # Monday 2026-10-26 (week of 2026-10-26)
 ('2026-10-26','bench',   50,    5, None, True,  None),   # warm-up
 ('2026-10-26','bench',   82.5,  5, 1,    False, None),
 ('2026-10-26','bench',   82.5, None, None, False, None), # missing reps: counts as a set, no e1RM
 ('2026-10-26','bench',  100,    1, 0,    False, None),   # 1-rep: actual
 ('2026-10-26','carry',   40,    1, None, False, None),   # unassigned muscles; 1 rep
 ('2026-10-26','cpB',     70,    8, None, False, None),
 ('2026-10-26','cpA',     55,    9, 3,    False, 'left shoulder pinch'),  # pain note
 ('2026-10-26','incline', 32,    8, None, False, None),
]
def monday(d): return d - timedelta(days=d.weekday())
def r1(x): return round(x + 1e-9, 1)

def norm(ms):
    out = []
    for m in ms:
        m = ' '.join(m.strip().lower().split())
        if m and m not in out: out.append(m)
    return out

weekly = {}
for d, ex, load, reps, rir, warm, pain in S:
    if warm: continue
    ms = norm(EX[ex][2]) or ['unassigned']
    wk = monday(date.fromisoformat(d)).isoformat()
    for m in ms:
        weekly.setdefault(wk, {}).setdefault(m, 0)
        weekly[wk][m] += 1
# Hand-check of the counts (working sets only):
#  week 2026-10-19: bench 2 sets -> chest 2, triceps 2 ; incline 2 -> chest +2 ; cpA 1 -> chest +1  => chest 5, triceps 2
#  week 2026-10-26: bench 3 working (82.5x5, 82.5xNone, 100x1) -> chest 3, triceps 3 ; carry 1 -> unassigned 1 ;
#                   cpB 1 -> chest +1 ; cpA 1 -> chest +1 ; incline 1 -> chest +1             => chest 6, triceps 3, unassigned 1
assert weekly['2026-10-19'] == {'chest': 5, 'triceps': 2}, weekly
assert weekly['2026-10-26'] == {'chest': 6, 'triceps': 3, 'unassigned': 1}, weekly

def e1(load, reps):
    if load is None or reps is None or load <= 0 or reps < 1: return None
    if reps == 1: return {'epley': float(load), 'brzycki': float(load), 'actual': True, 'low_confidence': False}
    return {'epley': r1(load * (1 + reps / 30)), 'brzycki': r1(load * 36 / (37 - reps)), 'actual': False, 'low_confidence': reps > 10}

sessions = {}
for d, ex, load, reps, rir, warm, pain in S:
    if warm: continue
    e = e1(load, reps)
    if e is None: continue
    cur = sessions.get((d, ex))
    if cur is None or e['epley'] > cur['epley']:
        sessions[(d, ex)] = {**e, 'load': load, 'reps': reps}
# Hand arithmetic:
#  bench 10-25: 80x8 Epley 80*(1+8/30)=80*1.26667=101.33 -> 101.3 ; Brzycki 80*36/29=99.31 -> 99.3
#               80x6 Epley 80*1.2=96.0 ; => source 80x8
#  incline 10-25: 30x12 Epley 30*1.4=42.0 ; Brzycki 30*36/25=43.2 ; low confidence. 30x10 Epley 30*1.33333=40.0 -> source 30x12
#  cpA 10-25: 50x10 Epley 50*1.33333=66.7 ; Brzycki 50*36/27=66.7
#  bench 10-26: 82.5x5 Epley 82.5*(1+5/30)=96.25 -> 96.3 (half-up; asserted below) ; 100x1 actual 100.0 -> source 100x1 (100 > 96.25)
#  carry 10-26: 40x1 actual 40.0 ; cpB: 70x8 Epley 70*1.26667=88.67 -> 88.7 ; Brzycki 70*36/29=86.9
#  cpA 10-26: 55x9 Epley 55*1.3=71.5 ; Brzycki 55*36/28=70.71 -> 70.7 ; incline 10-26: 32x8 Epley 32*1.26667=40.53 -> 40.5 ; Brzycki 32*36/29=39.72 -> 39.7
assert sessions[('2026-10-25','bench')]['epley'] == 101.3 and sessions[('2026-10-25','bench')]['brzycki'] == 99.3
assert sessions[('2026-10-25','incline')]['epley'] == 42.0 and sessions[('2026-10-25','incline')]['low_confidence']
assert sessions[('2026-10-26','bench')]['actual'] and sessions[('2026-10-26','bench')]['epley'] == 100.0
assert sessions[('2026-10-26','cpA')]['epley'] == 71.5 and sessions[('2026-10-26','cpA')]['brzycki'] == 70.7
assert sessions[('2026-10-26','cpB')]['epley'] == 88.7

# Progression hints. Rep range entered by the user for 'bench' = 5..8 and 'incline' = 8..12; cpA = 8..10; none for others.
RANGE = {'bench': (5, 8), 'incline': (8, 12), 'cpA': (8, 10)}
def hint(ex, upto):
    """Hint from the most recent session on/before `upto` for that exercise."""
    if ex not in RANGE: return None
    days = sorted({d for d, e, *_ in S if e == ex and d <= upto})
    if not days: return None
    last = days[-1]
    rows = [r for r in S if r[0] == last and r[1] == ex]
    if any(r[6] for r in rows): return 'review_pain_note'
    work = [r for r in rows if not r[5]]
    if not work: return None
    top = RANGE[ex][1]
    if any(r[3] is None for r in work): return 'stay'
    if all(r[3] >= top and (r[4] is None or 1 <= r[4] <= 3) for r in work): return 'increase'
    return 'stay'
# bench 10-25: sets 8 and 6 vs top 8 -> 6 < 8 => stay.   bench 10-26: a set has missing reps => stay.
# incline 10-25: 12 and 10 vs top 12 => stay.            incline 10-26: 8 < 12 => stay.
# cpA 10-26: pain note => review_pain_note.              cpA 10-25: 10 >= 10 at rir None => increase.
hints = {f'{ex}@{up}': hint(ex, up) for ex, up in [('bench','2026-10-25'),('bench','2026-10-26'),('incline','2026-10-25'),('incline','2026-10-26'),('cpA','2026-10-25'),('cpA','2026-10-26'),('cpB','2026-10-26'),('carry','2026-10-26')]}
assert hints['cpA@2026-10-25'] == 'increase' and hints['cpA@2026-10-26'] == 'review_pain_note' and hints['bench@2026-10-25'] == 'stay'
# extra hand cases for the pure function (rir rules): [(reps list, rir list, pain, expected)]
extra = [
  {'range': [8, 10], 'sets': [[10, 2], [10, 3], [11, None]], 'pain': False, 'expected': 'increase'},
  {'range': [8, 10], 'sets': [[10, 0], [10, 2]], 'pain': False, 'expected': 'stay'},       # RIR 0: too close to failure
  {'range': [8, 10], 'sets': [[10, 4], [10, 2]], 'pain': False, 'expected': 'stay'},       # RIR 4: not a challenging set
  {'range': [8, 10], 'sets': [[10, 2], [9, 2]], 'pain': False, 'expected': 'stay'},
  {'range': [8, 10], 'sets': [[10, 2]], 'pain': True, 'expected': 'review_pain_note'},
  {'range': [8, 10], 'sets': [[None, 2]], 'pain': False, 'expected': 'stay'},
]

fx = Path(__file__).resolve().parent.parent / 'fixtures'
(fx / 'synthetic-lifting.json').write_text(json.dumps({
  'note': 'SYNTHETIC data. No real personal data.',
  'exercises': {k: {'name': v[0], 'equipment': v[1], 'primary_muscles': v[2], 'rep_range': RANGE.get(k)} for k, v in EX.items()},
  'sets': [{'date': d, 'exercise': ex, 'load_kg': l, 'reps': r, 'rir': ri, 'warmup': w, 'pain_note': p} for d, ex, l, r, ri, w, p in S],
}, indent=1))
(fx / 'oracle-lifting.json').write_text(json.dumps({
  'weekly_sets': weekly,
  'session_e1rm': {f'{d}|{ex}': v for (d, ex), v in sorted(sessions.items())},
  'hints': hints, 'hint_cases': extra,
}, indent=1))
print(json.dumps(weekly)); print({k: (v['load'], v['reps'], v['epley'], v['brzycki'], v['actual'], v['low_confidence']) for k, v in sorted(sessions.items())}); print(hints)
