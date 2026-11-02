"""Independent "beat last time" oracle. Shares no code with the app. SYNTHETIC data only.
Usage: python3 -I tests/oracle/oracle_beat.py   (writes tests/fixtures/oracle-beat.json)

Rules (same as the on-screen explainer). All arithmetic is EXACT (fractions), no rounding anywhere:
  * Eligible set: not a warm-up, load > 0, 1 <= reps <= 36.
  * e1RM (Epley), scaled by 30 to stay integral:  E(load, reps) = load * (30 + reps) / 30,
    except reps == 1 where the set IS the lift:    E(load, 1)    = load.
  * Last time = best eligible set of the most recent prior session: highest E, ties go to MORE reps,
    still tied -> earliest in the list.
  * Pain: any set in that last session (warm-up included) with a pain note -> kind "pain": Last time only.
  * Target = same load, last reps + 1.
    If a rep range is set and last reps + 1 > rep_max:
        hint "increase" iff EVERY working set of the last session has reps >= rep_max and
                          (rir is None or 1 <= rir <= 3)           -> target = (load + 2.5) x rep_min, no alternative
        otherwise ("stay")                                         -> kind "hold": Last time only
  * Alternative = (load + 2.5), smallest reps r >= 1 with E(load + 2.5, r) >= E(last set)  (equality counts).
  * PR cue = E(target) > best E over ALL eligible sets ever recorded for the exercise (strictly greater).
  * No prior session, or prior session with no eligible working set and no pain note -> kind "none".
"""
import json
from fractions import Fraction as F
from pathlib import Path

INC = F(5, 2)


def eligible(s):
    return (not s['warmup']) and s['load_kg'] is not None and s['reps'] is not None and s['load_kg'] > 0 and 1 <= s['reps'] <= 36


def E(load, reps):
    load = F(str(load))
    return load if reps == 1 else load * (30 + reps) / 30


def num(x):
    x = F(x)
    return int(x) if x.denominator == 1 else float(x)


def solve(case):
    last, hist, rmin, rmax = case['last_sets'], case['all_sets'], case['rep_min'], case['rep_max']
    if last is None:
        return {'kind': 'none'}
    best = None
    for s in last:
        if not eligible(s):
            continue
        if best is None or (E(s['load_kg'], s['reps']), s['reps']) > (E(best['load_kg'], best['reps']), best['reps']):
            best = s
    pain = any(s['pain_note'] for s in last)
    lastv = {'load_kg': num(F(str(best['load_kg']))), 'reps': best['reps']} if best else None
    if pain:
        return {'kind': 'pain', 'last': lastv}
    if best is None:
        return {'kind': 'none'}
    load, reps = F(str(best['load_kg'])), best['reps']
    best_ever = max(E(s['load_kg'], s['reps']) for s in hist if eligible(s))
    t_load, t_reps, progressed = load, reps + 1, False
    if rmin is not None and rmax is not None and reps + 1 > rmax:
        work = [s for s in last if not s['warmup']]
        inc = all(s['reps'] is not None and s['reps'] >= rmax and (s['rir'] is None or 1 <= s['rir'] <= 3) for s in work)
        if not inc:
            return {'kind': 'hold', 'last': lastv}
        t_load, t_reps, progressed = load + INC, rmin, True
    out = {'kind': 'target', 'last': lastv,
           'target': {'load_kg': num(t_load), 'reps': t_reps, 'progressed': progressed}}
    out['pr'] = bool(t_reps <= 36 and E(t_load, t_reps) > best_ever)
    if progressed:
        out['alternative'] = None
    else:
        a_load = load + INC
        r = 1
        while E(a_load, r) < E(load, reps):
            r += 1
        out['alternative'] = {'load_kg': num(a_load), 'reps': r}
    return out


def S(load, reps, rir=None, warmup=False, pain=None):
    return {'load_kg': load, 'reps': reps, 'rir': rir, 'warmup': warmup, 'pain_note': pain}


# --- hand-worked arithmetic (checked by the asserts below) ------------------------------------------
# basic: last best 80x8 -> E = 80*38/30 = 101.333.. ; target 80x9 -> E = 80*39/30 = 104 > 101.33 -> PR true
#        alt 82.5: r=6 -> 82.5*36/30 = 99 < 101.33 ; r=7 -> 82.5*37/30 = 101.75 >= 101.33 -> 82.5x7
assert E(80, 8) == F(304, 3) and E(80, 9) == 104 and E(82.5, 6) == 99 and E(82.5, 7) == F(407, 4)
# tie: 60x9 -> 60*39/30 = 78 ; 65x6 -> 65*36/30 = 78 -> equal, more reps (9) wins
assert E(60, 9) == 78 and E(65, 6) == 78
# boundary: 60x20 -> 60*50/30 = 100 ; 62.5x18 -> 62.5*48/30 = 100 -> equal counts as meeting
assert E(60, 20) == 100 and E(62.5, 18) == 100 and E(62.5, 17) < 100
# one-rep: 100x1 -> 100 ; alt 102.5x1 = 102.5 >= 100 -> r = 1
assert E(100, 1) == 100

hist_bench = [S(90, 8)]
CASES = [
    ('basic_pr', 'Last 80x8 (warm-up ignored); target 80x9 beats best ever; alt 82.5x7', dict(
        last_sets=[S(40, 10, warmup=True), S(80, 8), S(80, 7)], all_sets=[S(40, 10, warmup=True), S(80, 8), S(80, 7), S(75, 8)],
        rep_min=None, rep_max=None)),
    ('pr_false', 'Earlier 90x8 (E=114) is above target E=104, so no PR cue', dict(
        last_sets=[S(80, 8)], all_sets=hist_bench + [S(80, 8)], rep_min=None, rep_max=None)),
    ('pr_equal_not_strict', 'Target E equals best ever exactly (80x9=104 vs 104): not strictly greater, no cue', dict(
        last_sets=[S(80, 8)], all_sets=[S(80, 8), S(104, 1)], rep_min=None, rep_max=None)),
    ('tie_more_reps', 'E tie 78 vs 78: 60x9 wins on reps even when listed second; target 60x10', dict(
        last_sets=[S(65, 6), S(60, 9)], all_sets=[S(65, 6), S(60, 9)], rep_min=None, rep_max=None)),
    ('pain_note', 'Pain note on a working set: Last time only', dict(
        last_sets=[S(80, 8), S(80, 7, pain='left shoulder pinch')], all_sets=[S(80, 8), S(80, 7)], rep_min=None, rep_max=None)),
    ('pain_on_warmup', 'Pain note on a warm-up also blocks (same as existing hint rule)', dict(
        last_sets=[S(40, 10, warmup=True, pain='tweak'), S(80, 8)], all_sets=[S(80, 8)], rep_min=None, rep_max=None)),
    ('no_history', 'No prior session', dict(last_sets=None, all_sets=[], rep_min=None, rep_max=None)),
    ('only_warmups', 'Prior session has only warm-ups: nothing comparable', dict(
        last_sets=[S(40, 10, warmup=True)], all_sets=[S(40, 10, warmup=True)], rep_min=None, rep_max=None)),
    ('range_cap_increase', 'Range 6-8, last 80x8 RIR 2 on all sets -> hint increase: 82.5 x 6 (rep_min), no alternative', dict(
        last_sets=[S(80, 8, 2), S(80, 8, 2)], all_sets=[S(80, 8, 2), S(80, 8, 2)], rep_min=6, rep_max=8)),
    ('range_cap_hold', 'Range 6-8, last 80x8 but one set RIR 0 -> stay: Last time only', dict(
        last_sets=[S(80, 8, 2), S(80, 8, 0)], all_sets=[S(80, 8, 2), S(80, 8, 0)], rep_min=6, rep_max=8)),
    ('range_no_cap', 'Range 6-12, last 80x8 -> plain +1 rep', dict(
        last_sets=[S(80, 8)], all_sets=[S(80, 8)], rep_min=6, rep_max=12)),
    ('range_cap_increase_pr', 'Range 6-8, last 100x8 -> 102.5x6: E=123 vs best ever 126.67 -> no PR', dict(
        last_sets=[S(100, 8, 2)], all_sets=[S(100, 8, 2)], rep_min=6, rep_max=8)),
    ('warmup_not_best_ever', 'A huge warm-up in history must not count as best ever: 70x10 -> 70x11 is a PR', dict(
        last_sets=[S(100, 12, warmup=True), S(70, 10)], all_sets=[S(100, 12, warmup=True), S(70, 10)], rep_min=None, rep_max=None)),
    ('alt_equality', 'Alternative exact-equality boundary: 60x20 (E=100) -> 62.5x18 (E=100)', dict(
        last_sets=[S(60, 20)], all_sets=[S(60, 20)], rep_min=None, rep_max=None)),
    ('one_rep', 'Single 100x1 (E=100): target 100x2; alt 102.5x1', dict(
        last_sets=[S(100, 1)], all_sets=[S(100, 1)], rep_min=None, rep_max=None)),
    ('missing_reps_skipped', 'A set with missing reps is not eligible; best is 70x5', dict(
        last_sets=[S(90, None), S(70, 5)], all_sets=[S(90, None), S(70, 5)], rep_min=None, rep_max=None)),
]

out = []
for cid, desc, c in CASES:
    out.append({'id': cid, 'desc': desc, **c, 'expected': solve(c)})

# Spot checks of the worked examples (fail loudly if the oracle itself is wrong)
by = {o['id']: o['expected'] for o in out}
assert by['basic_pr'] == {'kind': 'target', 'last': {'load_kg': 80, 'reps': 8}, 'target': {'load_kg': 80, 'reps': 9, 'progressed': False}, 'pr': True, 'alternative': {'load_kg': 82.5, 'reps': 7}}
assert by['pr_false']['pr'] is False
assert by['pr_equal_not_strict']['pr'] is False
assert by['tie_more_reps']['last'] == {'load_kg': 60, 'reps': 9} and by['tie_more_reps']['target']['reps'] == 10
assert by['range_cap_increase']['target'] == {'load_kg': 82.5, 'reps': 6, 'progressed': True} and by['range_cap_increase']['alternative'] is None
assert by['range_cap_hold']['kind'] == 'hold'
assert by['alt_equality']['alternative'] == {'load_kg': 62.5, 'reps': 18}
assert by['one_rep']['alternative'] == {'load_kg': 102.5, 'reps': 1}
assert by['warmup_not_best_ever']['pr'] is True
assert by['range_cap_increase_pr']['pr'] is False

dest = Path(__file__).resolve().parent.parent / 'fixtures' / 'oracle-beat.json'
dest.write_text(json.dumps(out, indent=1) + '\n')
print('wrote', dest, len(out), 'cases')
