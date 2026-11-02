"""Independent oracle for the Stage 4 backup/restore and CSV export tests (SYNTHETIC data only).

Run:  python3 -I tests/oracle/oracle_backup.py
Writes tests/fixtures/synthetic-backup-v3.json, -v2.json, -v1.json and oracle-backup-expected.json.
Nothing here imports or mirrors app code: the fixtures, expected counts and expected CSV text are built from
plain Python so the app's export can be compared against something it did not produce.
"""
import csv
import io
import json
import math
import os
import re
from datetime import date, timedelta

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fixtures')
TODAY = '2026-11-02'


def uid(prefix: int, n: int) -> str:
    return f'{prefix:08x}-0000-4000-8000-{n:012x}'


def ex_key(name: str, equipment: str) -> str:
    norm = lambda s: re.sub(r'\s+', ' ', s.strip().lower())
    return f'{norm(name)}|{norm(equipment)}'


HEADERS = ['Activity Type', 'Date', 'Title', 'Distance', 'Time', 'Avg Pace', 'Calories', 'Avg HR', 'Favorite']

# ---- batches and activities -------------------------------------------------------------------
batches = [
    {'id': uid(1, 1), 'owner_id': None, 'file_sha256': 'a' * 64, 'file_name': 'Activities.csv', 'imported_at': '2026-11-01T20:00:00.000Z',
     'headers': HEADERS, 'source_row_count': 8, 'new_row_count': 8, 'skipped_duplicate_count': 0},
    {'id': uid(1, 2), 'owner_id': None, 'file_sha256': 'b' * 64, 'file_name': None, 'imported_at': '2026-11-02T01:00:00.000Z',
     'headers': HEADERS, 'source_row_count': 6, 'new_row_count': 4, 'skipped_duplicate_count': 2},
]

# (type, date, time, title, km, seconds, pace, kcal, hr, override)
act_spec = [
    ('Running', '2026-10-05', '06:10:00', 'Easy run', 5.0, 1500, 300, 400, 140, None),
    ('Running', '2026-10-07', '06:00:00', 'Tempo', 10.0, 3000, 300, 800, 160, None),
    ('Running', '2026-10-14', '06:05:00', 'Long run', 15.0, 5400, 360, 1200, 150, None),
    ('Running', '2026-10-21', '06:00:00', 'No pace logged', 4.0, 1300, None, None, None, None),
    ('Running', '2026-10-28', '06:30:00', 'Hills', 8.0, 2800, 350, 700, 158, None),
    ('Treadmill Running', '2026-10-09', '17:00:00', 'Treadmill 5k', 5.0, 1650, 330, 380, 145, None),
    ('Treadmill Running', '2026-10-30', '17:10:00', 'Treadmill intervals', 6.0, 1800, 300, 450, 165, None),
    ('Strength Training', '2026-10-27', '18:00:00', '<img src=x onerror=alert(1)>', None, 3600, None, 300, 110, None),
    ('Strength Training', '2026-11-01', '06:28:42', '=HYPERLINK("http://example.invalid","click")', None, 3300, None, 280, 105, None),
    ('Cardio', '2026-10-29', '07:00:00', 'Café ✓ 走 ‮ rtl', None, 2400, None, 250, 120, 'weights'),
    ('Pool Swim', '2026-10-15', '12:00:00', 'Swim, "quoted" 1,650 m', None, 1800, None, 300, 125, None),
    ('Yoga', '2026-10-16', '19:00:00', '', None, None, None, None, None, None),
]
activities = []
for i, (typ, d, t, title, km, sec, pace, kcal, hr, ov) in enumerate(act_spec):
    batch = batches[0] if i < 8 else batches[1]
    raw_row = [typ, f'{d} {t}', title, '--' if km is None else str(km), '--' if sec is None else str(sec),
               '--' if pace is None else f'{pace // 60}:{pace % 60:02d}', '--' if kcal is None else f'{kcal:,}', '--' if hr is None else str(hr), 'false']
    parsed = {
        'Activity Type': typ, 'Date': f'{d} {t}', 'Title': title, 'Distance': km, 'Time': sec,
        'Avg Pace': pace, 'Calories': kcal, 'Avg HR': hr, 'Favorite': False,
    }
    activities.append({
        'id': uid(2, i + 1), 'owner_id': None, 'batch_id': batch['id'], 'source_file_sha256': batch['file_sha256'],
        'row_index': i, 'row_hash': f'{i:064x}', 'dedupe_key': f'{i:064x}#0', 'raw_row': raw_row,
        'raw_fields': dict(zip(HEADERS, raw_row)), 'parsed': parsed,
        'timestamp_local': f'{d} {t}', 'date': d, 'original_type': typ, 'mapping_override': ov, 'title': title,
        'distance_km': None if typ == 'Pool Swim' else km, 'duration_seconds': sec, 'calories': kcal, 'avg_hr': hr,
        'avg_pace_sec_per_km': pace,
    })

type_mappings = [
    {'id': uid(3, 1), 'owner_id': None, 'original_type': 'Pool Swim', 'target': 'other', 'updated_at': '2026-11-02T02:00:00.000Z'},
    {'id': uid(3, 2), 'owner_id': None, 'original_type': 'Yoga', 'target': 'weights', 'updated_at': '2026-11-02T02:01:00.000Z'},
]

# ---- exercises, workouts, sets ----------------------------------------------------------------
ex_spec = [
    ('Bench Press', 'Barbell', ['Chest', ' triceps '], 5, 8, True),
    ('Incline Press', 'Dumbbell', ['chest'], None, None, True),   # rep range explicitly null
    ('Farmer Carry', 'Handles', [], None, None, False),            # rep fields absent entirely
    ('=SUM(A1)  Squat', '', ['Quads'], 6, 10, True),                # formula-looking name, blank equipment
]
exercises = []
for i, (name, eq, mus, mn, mx, has_rep) in enumerate(ex_spec):
    e = {'id': uid(4, i + 1), 'owner_id': None, 'name': name, 'equipment': eq, 'primary_muscles': mus,
         'exercise_key': ex_key(name, eq), 'created_at': f'2026-10-01T00:00:0{i}.000Z'}
    if has_rep:
        e['rep_min'] = mn
        e['rep_max'] = mx
    exercises.append(e)

workouts = [
    {'id': uid(5, 1), 'owner_id': None, 'date': '2026-10-27', 'name': 'Push', 'kind': 'weights', 'status': 'done', 'notes': 'felt good, "heavy"',
     'planned_exercise_ids': [exercises[0]['id'], exercises[1]['id']], 'linked_activity_id': activities[7]['id'], 'created_at': '2026-10-27T08:00:00.001Z'},
    {'id': uid(5, 2), 'owner_id': None, 'date': '2026-10-27', 'name': '', 'kind': 'weights', 'status': 'planned', 'notes': '',
     'planned_exercise_ids': [], 'linked_activity_id': None, 'created_at': '2026-10-27T09:00:00.002Z'},
    {'id': uid(5, 3), 'owner_id': None, 'date': '2026-11-01', 'name': '-leg day', 'kind': 'weights', 'status': 'done', 'notes': '+extra\nsecond line',
     'planned_exercise_ids': [exercises[3]['id']], 'linked_activity_id': None, 'created_at': '2026-11-01T06:00:00.003Z'},
    {'id': uid(5, 4), 'owner_id': None, 'date': '2026-11-02', 'name': 'Easy run', 'kind': 'run', 'status': 'planned', 'notes': '',
     'planned_exercise_ids': [], 'linked_activity_id': None, 'created_at': '2026-11-02T05:00:00.004Z'},
]

# (workout idx, exercise idx, ordinal, load, reps, rir, warmup, pain_note)
set_spec = [
    (0, 0, 1, 40.0, 10, None, True, None),
    (0, 0, 2, 80.0, 8, 2.0, False, None),
    (0, 0, 3, 80.0, 7, 0.5, False, '@left shoulder, "pinch"'),
    (0, 1, 4, 24.0, 12, 1.0, False, None),
    (2, 3, 1, 100.0, 5, None, False, '+sore\tknee'),
    (2, 3, 2, None, 8, None, False, None),   # bodyweight-ish: load unknown stays blank
    (2, 3, 3, 102.5, None, None, False, None),
    (2, 2, 4, 32.0, 20, 3.5, False, 'line1\nline2'),
    (2, 2, 5, 0.0, 0, None, False, None),
]
sets = []
for i, (w, e, o, load, reps, rir, wu, pain) in enumerate(set_spec):
    sets.append({'id': uid(6, i + 1), 'owner_id': None, 'workout_id': workouts[w]['id'], 'exercise_id': exercises[e]['id'], 'ordinal': o,
                 'load_kg': load, 'reps': reps, 'rir': rir, 'warmup': wu, 'pain_note': pain, 'created_at': f'2026-11-02T03:00:{i:02d}.000Z'})

TABLES6 = ['batches', 'activities', 'type_mappings', 'exercises', 'workouts', 'sets']
data = {'batches': batches, 'activities': activities, 'type_mappings': type_mappings,
        'exercises': exercises, 'workouts': workouts, 'sets': sets}


def doc(version: int, tables: dict) -> dict:
    return {'format': 'eq-fit-backup', 'schemaVersion': version, 'appVersion': '0.4.0', 'exportedAt': '2026-11-02T04:00:00.000Z',
            'counts': {k: len(v) for k, v in tables.items()}, 'tables': tables}


v3 = doc(3, data)
v2_tables = json.loads(json.dumps(data))
for e in v2_tables['exercises']:
    e.pop('rep_min', None)
    e.pop('rep_max', None)
v2 = doc(2, v2_tables)
v1 = doc(1, {k: json.loads(json.dumps(data[k])) for k in ['batches', 'activities', 'type_mappings']})
# a v1 document knows nothing of lifting; its activities may not be linked, which is fine


# ---- expected CSV text -------------------------------------------------------------------------
def guard(s):
    if isinstance(s, str) and s and s[0] in '=+-@\t\r':
        return "'" + s
    return s


def cellval(v):
    if v is None:
        return ''
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else repr(v)
    return guard(v)


def to_csv(header, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\r\n', quoting=csv.QUOTE_MINIMAL)
    w.writerow(header)
    for r in rows:
        w.writerow([cellval(c) for c in r])
    return '﻿' + buf.getvalue()


SET_HEADER = ['workout_date', 'workout_name', 'workout_kind', 'workout_status', 'workout_notes', 'exercise', 'equipment', 'set_number',
              'load_kg', 'reps', 'rir', 'warmup', 'pain_note']
exm = {e['id']: e for e in exercises}
rows = []
for w in sorted(workouts, key=lambda w: (w['date'], w['created_at'])):
    ws = sorted([s for s in sets if s['workout_id'] == w['id']], key=lambda s: s['ordinal'])
    head = [w['date'], w['name'], w['kind'], w['status'], w['notes']]
    if not ws:
        rows.append(head + [None] * 8)
    for s in ws:
        e = exm[s['exercise_id']]
        rows.append(head + [e['name'], e['equipment'], s['ordinal'], s['load_kg'], s['reps'], s['rir'], s['warmup'], s['pain_note']])
sets_csv = to_csv(SET_HEADER, rows)


# running periods: outdoor only vs with treadmill, over 4 complete weeks, their union and the last complete month
def d(s):
    return date.fromisoformat(s)


def monday(s):
    return d(s) - timedelta(days=d(s).weekday())


last_mon = monday(TODAY) - timedelta(days=7)
weeks = [(last_mon - timedelta(days=7 * i), last_mon - timedelta(days=7 * i) + timedelta(days=6)) for i in range(3, -1, -1)]
first_this = d(TODAY).replace(day=1)
m_end = first_this - timedelta(days=1)
m_start = m_end.replace(day=1)
periods = [(f'Week {i + 1} of 4', a, b) for i, (a, b) in enumerate(weeks)]
periods.append(('4 weeks combined', weeks[0][0], weeks[3][1]))
periods.append((f'Month {m_end.isoformat()[:7]}', m_start, m_end))


def group_of(a):
    ov = a['mapping_override']
    if ov:
        return ov
    mp = {m['original_type']: m['target'] for m in type_mappings}
    dm = {'Cardio': 'weights', 'Strength Training': 'weights', 'Running': 'outdoor_run', 'Treadmill Running': 'treadmill_run'}
    return mp.get(a['original_type']) or dm.get(a['original_type']) or 'other'


def r2(x):
    return math.floor(x * 100 + 0.5) / 100


RUN_HEADER = ['period', 'start', 'end', 'treadmill_included', 'runs', 'runs_with_pace', 'km', 'pace_sec_per_km']
run_rows = []
for tread in (False, True):
    for label, a, b in periods:
        sel = [x for x in activities if a.isoformat() <= x['date'] <= b.isoformat()
               and (group_of(x) == 'outdoor_run' or (tread and group_of(x) == 'treadmill_run'))]
        with_km = [x for x in sel if x['distance_km'] is not None]
        paced = [x for x in sel if x['avg_pace_sec_per_km'] is not None and x['distance_km'] is not None and x['distance_km'] > 0]
        dist = sum(x['distance_km'] for x in paced)
        km = r2(sum(x['distance_km'] for x in with_km)) if with_km else None
        pace = r2(sum(x['avg_pace_sec_per_km'] * x['distance_km'] for x in paced) / dist) if dist > 0 else None
        run_rows.append([label, a.isoformat(), b.isoformat(), tread, len(sel), len(paced), km, pace])
running_csv = to_csv(RUN_HEADER, run_rows)


def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


dump('synthetic-backup-v3.json', v3)
dump('synthetic-backup-v2.json', v2)
dump('synthetic-backup-v1.json', v1)
dump('oracle-backup-expected.json', {
    'note': 'SYNTHETIC. Built by tests/oracle/oracle_backup.py, not by app code.',
    'today': TODAY,
    'counts_v3': {k: len(v) for k, v in data.items()},
    'counts_v1': {k: len(data[k]) for k in ['batches', 'activities', 'type_mappings']},
    'sets_csv': sets_csv,
    'running_csv': running_csv,
})
print('counts', {k: len(v) for k, v in data.items()})
print(running_csv)
