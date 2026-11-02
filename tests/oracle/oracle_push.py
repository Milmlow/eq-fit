"""Independent oracle for the Stage 5 push layer (SYNTHETIC data only; no app code is imported or mirrored line by line).

Run:  python3 -I tests/oracle/oracle_push.py
Writes tests/fixtures/oracle-push.json (inputs AND expected outputs) and tests/fixtures/synthetic-backup-v4.json.
Arithmetic uses exact fractions. Every expected PR / figure below was also worked by hand (see the comments and the asserts);
the script stops if its own computation disagrees with the hand-worked values.
"""
import json
import math
import os
from datetime import date, timedelta
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
FX = os.path.join(HERE, '..', 'fixtures')


def d(s):
    return date.fromisoformat(s)


def add(s, n):
    return (d(s) + timedelta(days=n)).isoformat()


def monday(s):
    return add(s, -d(s).weekday())


def half_up(fr, places):
    k = 10 ** places
    return math.floor(fr * k + Fraction(1, 2)) / k


# ================= 1. achieved PR ====================================================================
def e1rm(load, reps):
    # Epley; a single rep is the lift itself
    return Fraction(load) if reps == 1 else Fraction(load) * (30 + reps) / 30


def eligible(s):
    return (not s['warmup'] and s['load_kg'] is not None and s['reps'] is not None and s['load_kg'] > 0
            and isinstance(s['reps'], int) and 1 <= s['reps'] <= 36)


workouts = {
    'wA1': ('2026-10-05', '2026-10-05T07:00:00.000Z'), 'wA2': ('2026-10-12', '2026-10-12T07:00:00.000Z'),
    'wA3': ('2026-10-19', '2026-10-19T07:00:00.000Z'), 'wA4': ('2026-10-26', '2026-10-26T08:00:00.000Z'),
    'wA5': ('2026-10-26', '2026-10-26T17:00:00.000Z'), 'wC1': ('2026-10-14', '2026-10-14T07:00:00.000Z'),
}
# (id, workout, exercise, ordinal, load, reps, warmup)
raw_sets = [
    ('s1', 'wA1', 'exA', 1, 60, 8, False),     # 60*38/30 = 76.0  first ever set: baseline, not a PR
    ('s2', 'wA1', 'exA', 2, 100, 10, True),    # warm-up: ignored
    ('s3', 'wA2', 'exA', 1, 60, 8, False),     # 76.0 equals best: not a PR
    ('s4', 'wA2', 'exA', 2, 62.5, 8, False),   # 62.5*38/30 = 79.1667 > 76.0: PR
    ('s5', 'wA2', 'exA', 3, 62.5, 8, False),   # equals new best: not a PR
    ('s6', 'wA3', 'exA', 1, 65, 5, False),     # 65*35/30 = 75.83: below best
    ('s7', 'wA3', 'exA', 2, 60, None, False),  # reps missing: never a PR
    ('s8', 'wA3', 'exA', 3, None, 10, False),  # load missing: never a PR
    ('s9', 'wA3', 'exA', 4, 200, 1, True),     # warm-up single: ignored
    ('s10', 'wA3', 'exA', 5, 10, 40, False),   # 40 reps is outside 1..36: ignored
    ('s11', 'wA4', 'exA', 1, 80, 1, False),    # single rep = 80 > 79.1667: PR
    ('s12', 'wA5', 'exA', 1, 80, 1, False),    # later workout same day: 80 equals best: not a PR
    ('s13', 'wA5', 'exA', 2, 82.5, 1, False),  # 82.5 > 80: PR
    ('s14', 'wA2', 'exB', 1, 30, 10, False),   # exB = same name, DIFFERENT equipment. 30*40/30 = 40.0 baseline
    ('s15', 'wA3', 'exB', 1, 35, 10, False),   # 35*40/30 = 46.67 > 40.0: PR for exB (exA's 79 does not block it)
    ('s16', 'wC1', 'exC', 1, 100, 5, False),   # lone set of another exercise: baseline, not a PR
]
HAND_PR = ['s4', 's11', 's13', 's15']
pr_sets = []
for sid, w, ex, o, load, reps, wu in raw_sets:
    pr_sets.append({'id': sid, 'workout_id': w, 'exercise_id': ex, 'ordinal': o, 'load_kg': load, 'reps': reps, 'warmup': wu,
                    'date': workouts[w][0], 'workout_created_at': workouts[w][1]})
computed = []
by_ex = {}
for s in pr_sets:
    by_ex.setdefault(s['exercise_id'], []).append(s)
for ex, lst in by_ex.items():
    lst.sort(key=lambda s: (s['date'], s['workout_created_at'], s['ordinal']))
    best = None
    for s in lst:
        if not eligible(s):
            continue
        v = e1rm(s['load_kg'], s['reps'])
        if best is not None and v > best:
            computed.append({'setId': s['id'], 'e1rm': half_up(v, 1), 'previousBest': half_up(best, 1)})
        best = v if best is None or v > best else best
assert sorted(c['setId'] for c in computed) == sorted(HAND_PR), computed
pr_input = list(reversed(pr_sets))  # deliberately not in chronological order

# ================= 2. weekly goal progress across Sunday / Monday ====================================
revs = [
    {'id': 'g1a', 'goal_id': 'g1a', 'kind': 'lifts_per_week', 'name': 'Lift 3x', 'target': 3, 'muscle': None, 'include_treadmill': False, 'effective_from': '2026-10-14', 'archived': False, 'created_at': '2026-10-14T01:00:00.000Z'},
    {'id': 'g2a', 'goal_id': 'g2a', 'kind': 'runs_per_week', 'name': 'Run twice', 'target': 2, 'muscle': None, 'include_treadmill': False, 'effective_from': '2026-10-12', 'archived': False, 'created_at': '2026-10-14T02:00:00.000Z'},
    {'id': 'g3a', 'goal_id': 'g3a', 'kind': 'km_per_week', 'name': '<b>20 km</b>', 'target': 20, 'muscle': None, 'include_treadmill': True, 'effective_from': '2026-10-19', 'archived': False, 'created_at': '2026-10-19T01:00:00.000Z'},
    {'id': 'g4a', 'goal_id': 'g4a', 'kind': 'sets_per_muscle_per_week', 'name': 'Chest sets', 'target': 10, 'muscle': 'chest', 'include_treadmill': False, 'effective_from': '2026-10-19', 'archived': False, 'created_at': '2026-10-19T02:00:00.000Z'},
    {'id': 'g1b', 'goal_id': 'g1a', 'kind': 'lifts_per_week', 'name': 'Lift 4x', 'target': 4, 'muscle': None, 'include_treadmill': False, 'effective_from': '2026-10-26', 'archived': False, 'created_at': '2026-10-28T01:00:00.000Z'},
    {'id': 'g2b', 'goal_id': 'g2a', 'kind': 'runs_per_week', 'name': 'Run twice', 'target': 2, 'muscle': None, 'include_treadmill': False, 'effective_from': '2026-11-02', 'archived': True, 'created_at': '2026-11-02T01:00:00.000Z'},
]
acts = [
    {'id': 'a1', 'date': '2026-10-18', 'group': 'weights', 'distance_km': None},
    {'id': 'a2', 'date': '2026-10-19', 'group': 'weights', 'distance_km': None},
    {'id': 'a3', 'date': '2026-10-25', 'group': 'weights', 'distance_km': None},
    {'id': 'a4', 'date': '2026-10-26', 'group': 'weights', 'distance_km': None},
    {'id': 'a5', 'date': '2026-10-25', 'group': 'outdoor_run', 'distance_km': 5.0},
    {'id': 'a6', 'date': '2026-10-26', 'group': 'outdoor_run', 'distance_km': 8.25},
    {'id': 'a7', 'date': '2026-10-26', 'group': 'treadmill_run', 'distance_km': 3.1},
    {'id': 'a8', 'date': '2026-11-01', 'group': 'outdoor_run', 'distance_km': None},
    {'id': 'a9', 'date': '2026-11-02', 'group': 'outdoor_run', 'distance_km': 10.0},
    {'id': 'a10', 'date': '2026-10-27', 'group': 'other', 'distance_km': 2.0},
]
wos = [
    {'id': 'w1', 'date': '2026-10-25', 'kind': 'weights', 'status': 'done', 'linked_activity_id': 'a3'},
    {'id': 'w2', 'date': '2026-10-25', 'kind': 'weights', 'status': 'done', 'linked_activity_id': None},
    {'id': 'w3', 'date': '2026-10-26', 'kind': 'weights', 'status': 'done', 'linked_activity_id': None},
    {'id': 'w4', 'date': '2026-10-27', 'kind': 'weights', 'status': 'planned', 'linked_activity_id': None},
    {'id': 'w5', 'date': '2026-10-28', 'kind': 'run', 'status': 'done', 'linked_activity_id': None},
    {'id': 'w6', 'date': '2026-10-18', 'kind': 'weights', 'status': 'done', 'linked_activity_id': None},
]
fsets = (
    [{'date': '2026-10-25', 'warmup': False, 'muscles': ['chest']}] * 3
    + [{'date': '2026-10-25', 'warmup': True, 'muscles': ['chest']},
       {'date': '2026-10-25', 'warmup': False, 'muscles': ['Chest ', 'Triceps']},
       {'date': '2026-10-25', 'warmup': False, 'muscles': ['back']}]
    + [{'date': '2026-10-26', 'warmup': False, 'muscles': ['chest']}] * 2
    + [{'date': '2026-10-26', 'warmup': False, 'muscles': ['back']}] * 2
)
GOAL_WEEKS = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']


def norm_m(ms):
    return [' '.join(m.strip().lower().split()) for m in ms if m.strip()]


def goal_progress(latest):
    out = {}
    for ws in GOAL_WEEKS:
        we = add(ws, 6)
        inw = lambda x: ws <= x <= we
        # revision in force: latest (by week of effective_from, then created_at) among those starting on/before this week
        best = {}
        for r in sorted(revs, key=lambda r: (monday(r['effective_from']), r['created_at'])):
            if monday(r['effective_from']) <= ws:
                best[r['goal_id']] = r
        rows = []
        root_created = {r['id']: r['created_at'] for r in revs}
        for r in sorted((r for r in best.values() if not r['archived']), key=lambda r: root_created[r['goal_id']]):
            partial = r['kind'] != 'sets_per_muscle_per_week' and (latest is None or latest < ws)
            if r['kind'] == 'sets_per_muscle_per_week':
                v = sum(1 for s in fsets if inw(s['date']) and not s['warmup'] and r['muscle'] in norm_m(s['muscles']))
            elif r['kind'] == 'lifts_per_week':
                v = sum(1 for a in acts if inw(a['date']) and a['group'] == 'weights')
                v += sum(1 for w in wos if inw(w['date']) and w['kind'] == 'weights' and w['status'] == 'done' and w['linked_activity_id'] is None)
            else:
                groups = ['outdoor_run', 'treadmill_run'] if r['include_treadmill'] else ['outdoor_run']
                ra = [a for a in acts if inw(a['date']) and a['group'] in groups]
                if r['kind'] == 'runs_per_week':
                    v = len(ra) + sum(1 for w in wos if inw(w['date']) and w['kind'] == 'run' and w['status'] == 'done' and w['linked_activity_id'] is None)
                else:
                    v = round(sum(Fraction(str(a['distance_km'])) for a in ra if a['distance_km'] is not None), 2)
                    v = float(v)
            rows.append({'rev_id': r['id'], 'value': v, 'target': r['target'], 'met': v >= r['target'], 'partial': partial})
        out[ws] = rows
    return out


goals_full = goal_progress('2026-11-02')
goals_lagging = goal_progress('2026-10-20')
# hand-worked spot checks (see the notes beside the data):
def row(week, rid, table=goals_full):
    return next(x for x in table[week] if x['rev_id'] == rid)

assert row('2026-10-12', 'g1a')['value'] == 2 and row('2026-10-12', 'g1a')['target'] == 3        # a1 (Sun 18th) + w6
assert [x['rev_id'] for x in goals_full['2026-10-12']] == ['g1a', 'g2a']                          # g3, g4 start 19 Oct
assert row('2026-10-19', 'g1a')['value'] == 3 and row('2026-10-19', 'g1a')['met']                 # a2 + a3 + w2 (w1 is linked to a3)
assert row('2026-10-19', 'g2a')['value'] == 1                                                     # a5 (Sun 25th)
assert row('2026-10-19', 'g3a')['value'] == 5.0
assert row('2026-10-19', 'g4a')['value'] == 4                                                     # 3 + 'Chest ' set; warm-up excluded
assert row('2026-10-26', 'g1b')['target'] == 4 and row('2026-10-26', 'g1b')['value'] == 2         # a4 + w3 (w4 planned)
assert row('2026-10-26', 'g2a')['value'] == 3 and row('2026-10-26', 'g2a')['met']                 # a6 + a8 (no distance) + w5
assert row('2026-10-26', 'g3a')['value'] == 11.35                                                 # 8.25 + 3.1 + nothing for a8
assert row('2026-10-26', 'g4a')['value'] == 2
assert [x['rev_id'] for x in goals_full['2026-11-02']] == ['g1b', 'g3a', 'g4a']                   # g2 archived from this week
assert row('2026-11-02', 'g3a')['value'] == 10.0 and row('2026-11-02', 'g1b')['value'] == 0
assert row('2026-10-26', 'g1b', goals_lagging)['partial'] and not row('2026-10-19', 'g1a', goals_lagging)['partial']
assert not row('2026-10-26', 'g4a', goals_lagging)['partial']

# ================= 3. running bests ===================================================================
# (date, group, km, pace sec/km)
bruns = [
    ('2026-10-05', 'outdoor_run', 5.0, 300),     # qualifies for 5k
    ('2026-10-07', 'outdoor_run', 10.0, 310),    # qualifies for 5k and 10k
    ('2026-10-09', 'outdoor_run', 4.9, 280),     # fastest pace but 4.9 km: NOT a 5k, still counts toward longest/week
    ('2026-10-13', 'outdoor_run', 12.0, None),   # no pace: excluded from every best
    ('2026-10-14', 'outdoor_run', 21.1, 345),    # longest; 5k and 10k pool
    ('2026-10-16', 'treadmill_run', 10.5, 270),  # treadmill: excluded
    ('2026-10-20', 'outdoor_run', None, 250),    # no distance: excluded
    ('2026-10-21', 'outdoor_run', 5.2, 290),     # fastest 5k+ (290)
    ('2026-10-23', 'outdoor_run', 5.0, 290),     # ties 290 with 5.2 km run on a LATER date? no: 21st is earlier, so the 21st wins
]
brun_in = [{'date': a, 'group': g, 'distance_km': k, 'avg_pace_sec_per_km': p} for a, g, k, p in bruns]
valid = [(a, k, p) for a, g, k, p in bruns if g == 'outdoor_run' and k is not None and k > 0 and p is not None and p > 0]


def best_pace(minkm):
    pool = [(a, k, p) for a, k, p in valid if k >= minkm]
    if not pool:
        return {'value': None, 'date': None, 'n': 0}
    m = min(p for _, _, p in pool)
    return {'value': m, 'date': min(a for a, _, p in pool if p == m), 'n': len(pool)}


wk = {}
for a, k, p in valid:
    wk.setdefault(monday(a), []).append(Fraction(str(k)))
wk_tot = {w: sum(v) for w, v in wk.items()}
bw = max(wk_tot.values())
bw_week = min(w for w, t in wk_tot.items() if t == bw)
lk = max(k for _, k, _ in valid)
bests = {
    'fastest5k': best_pace(5), 'fastest10k': best_pace(10),
    'longest': {'value': lk, 'date': min(a for a, k, _ in valid if k == lk), 'n': len(valid)},
    'bestWeek': {'value': float(bw), 'date': bw_week, 'n': len(wk_tot), 'runsInWeek': len(wk[bw_week])},
}
# hand-worked: valid runs = 10-05 5.0, 10-07 10.0, 10-09 4.9, 10-14 21.1, 10-21 5.2, 10-23 5.0  (6 runs)
# 5k pool (>=5): 5.0@300, 10.0@310, 21.1@345, 5.2@290, 5.0@290 -> n=5, best 290, tie broken to earliest = 2026-10-21
# 10k pool (>=10): 10.0@310, 21.1@345 -> best 310 on 2026-10-07, n=2.  longest 21.1 on 2026-10-14, n=6
# weeks: Mon 10-05: 5.0+10.0+4.9 = 19.9 | Mon 10-12: 21.1 | Mon 10-19: 5.2+5.0 = 10.2  -> best week 10-12, 21.1 km, 1 run, 3 weeks
assert bests['fastest5k'] == {'value': 290, 'date': '2026-10-21', 'n': 5}
assert bests['fastest10k'] == {'value': 310, 'date': '2026-10-07', 'n': 2}
assert bests['longest'] == {'value': 21.1, 'date': '2026-10-14', 'n': 6}
assert bests['bestWeek'] == {'value': 21.1, 'date': '2026-10-12', 'n': 3, 'runsInWeek': 1}
bests_empty = {k: {'value': None, 'date': None, 'n': 0} for k in ['fastest5k', 'fastest10k', 'longest', 'bestWeek']}

# ================= 4. 7-calendar-day mean ============================================================
# date, weight, waist
cks = [
    ('2026-10-25', 83.0, None),     # one day before the 26 Oct window start
    ('2026-10-26', 82.4, 90.0),
    ('2026-10-27', 82.0, None),
    ('2026-10-29', 81.6, 89.5),
    ('2026-10-31', 81.9, None),
    ('2026-11-02', 81.5, 89.0),
    ('2026-11-04', 70.0, 70.0),     # in the future relative to every selected date below
]
ck_in = [{'date': a, 'weight_kg': w, 'waist_cm': c} for a, w, c in cks]


def mean7(sel, idx):
    start = add(sel, -6)
    vals = [Fraction(str(e[idx])) for e in cks if e[idx] is not None and start <= e[0] <= sel]
    return {'mean': half_up(sum(vals) / len(vals), 2) if vals else None, 'n': len(vals), 'start': start, 'end': sel}


mean_cases = []
for sel in ['2026-11-01', '2026-11-02', '2026-10-20', '2026-10-31']:
    mean_cases.append({'selected': sel, 'weight': mean7(sel, 1), 'waist': mean7(sel, 2)})
# hand-worked: selected 11-01 -> window 10-26..11-01: weights 82.4, 82.0, 81.6, 81.9 = 327.9 / 4 = 81.975 -> 81.98 (half up), n=4
#                                waists 90.0, 89.5 = 179.5 / 2 = 89.75, n=2
# selected 11-02 -> window 10-27..11-02: weights 82.0, 81.6, 81.9, 81.5 = 327.0 / 4 = 81.75, n=4; waists 89.5, 89.0 = 89.25, n=2
# selected 10-20 -> window 10-14..10-20: nothing -> null, n=0
# selected 10-31 -> window 10-25..10-31: 83.0 82.4 82.0 81.6 81.9 = 410.9 / 5 = 82.18, n=5; waists 90.0 89.5 -> 89.75, n=2
c0 = mean_cases[0]
assert c0['weight'] == {'mean': 81.98, 'n': 4, 'start': '2026-10-26', 'end': '2026-11-01'} and c0['waist']['mean'] == 89.75 and c0['waist']['n'] == 2
assert mean_cases[1]['weight']['mean'] == 81.75 and mean_cases[1]['waist']['mean'] == 89.25
assert mean_cases[2]['weight'] == {'mean': None, 'n': 0, 'start': '2026-10-14', 'end': '2026-10-20'}
assert mean_cases[3]['weight']['mean'] == 82.18 and mean_cases[3]['weight']['n'] == 5
# a "last 7 entries" rule would give a different answer for selected 11-01 (it would reach back to 10-25 and use the 11-02 entry), so the cases differ

oracle = {
    'pr': {'input': pr_input, 'expected_set_ids': sorted(HAND_PR), 'expected': sorted(computed, key=lambda c: c['setId'])},
    'goals': {'revisions': revs, 'facts': {'activities': acts, 'workouts': wos, 'sets': fsets}, 'weeks': GOAL_WEEKS,
              'expected_full': goals_full, 'expected_lagging': goals_lagging, 'latest_full': '2026-11-02', 'latest_lagging': '2026-10-20'},
    'bests': {'runs': brun_in, 'expected': bests, 'expected_empty': bests_empty},
    'checkins': {'entries': ck_in, 'cases': mean_cases},
}
with open(os.path.join(FX, 'oracle-push.json'), 'w') as f:
    json.dump(oracle, f, indent=1)

# ================= 5. v4 backup fixture (goals + check-ins on top of the v3 fixture) =================
with open(os.path.join(FX, 'synthetic-backup-v3.json')) as f:
    v3 = json.load(f)
t = json.loads(json.dumps(v3['tables']))
t['goals'] = [
    {'id': 'f0000001-0000-4000-8000-000000000001', 'owner_id': None, 'goal_id': 'f0000001-0000-4000-8000-000000000001', 'kind': 'runs_per_week', 'name': '=Run <b>3x</b>', 'target': 3,
     'muscle': None, 'include_treadmill': False, 'effective_from': '2026-10-12', 'archived': False, 'created_at': '2026-10-12T01:00:00.000Z'},
    {'id': 'f0000001-0000-4000-8000-000000000002', 'owner_id': None, 'goal_id': 'f0000001-0000-4000-8000-000000000001', 'kind': 'runs_per_week', 'name': '=Run <b>3x</b>', 'target': 4,
     'muscle': None, 'include_treadmill': True, 'effective_from': '2026-10-26', 'archived': False, 'created_at': '2026-10-27T01:00:00.000Z'},
    {'id': 'f0000001-0000-4000-8000-000000000003', 'owner_id': None, 'goal_id': 'f0000001-0000-4000-8000-000000000003', 'kind': 'sets_per_muscle_per_week', 'name': 'Chest\nsets',
     'target': 10, 'muscle': 'chest', 'include_treadmill': False, 'effective_from': '2026-10-19', 'archived': False, 'created_at': '2026-10-19T01:00:00.000Z'},
]
t['checkins'] = [
    {'id': 'f0000002-0000-4000-8000-000000000001', 'owner_id': None, 'date': '2026-10-31', 'weight_kg': 81.9, 'waist_cm': None, 'note': '<img src=x onerror=alert(1)>', 'created_at': '2026-10-31T21:00:00.000Z'},
    {'id': 'f0000002-0000-4000-8000-000000000002', 'owner_id': None, 'date': '2026-11-01', 'weight_kg': None, 'waist_cm': 89.5, 'note': None, 'created_at': '2026-11-01T21:00:00.000Z'},
    {'id': 'f0000002-0000-4000-8000-000000000003', 'owner_id': None, 'date': '2026-11-02', 'weight_kg': 81.5, 'waist_cm': 89.0, 'note': '=1+1\n"quoted", tab\there', 'created_at': '2026-11-02T06:00:00.000Z'},
]
v4 = {'format': 'eq-fit-backup', 'schemaVersion': 4, 'appVersion': '0.5.0', 'exportedAt': '2026-11-02T04:00:00.000Z',
      'counts': {k: len(v) for k, v in t.items()}, 'tables': t}
with open(os.path.join(FX, 'synthetic-backup-v4.json'), 'w') as f:
    json.dump(v4, f, indent=1)
with open(os.path.join(FX, 'oracle-push-backup-expected.json'), 'w') as f:
    json.dump({'counts_v4': v4['counts']}, f, indent=1)
print('oracle ok:', {k: len(v) for k, v in t.items()})
