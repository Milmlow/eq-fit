# Notes (things noticed, deliberately not acted on in Stage 1)

- Pool Swim rows: Distance is in metres ("1,650") and pace is per 100 m. distance_km and avg_pace_sec_per_km are stored as null for Pool Swim; raw values are preserved. Confirm units before Stage 2 comparisons.
- Cycling, Indoor Cycling and Golf rows have decimal "Avg Pace" values (km/h style, e.g. 21.9). Not parsed as pace (null, raw kept).
- Min/Max Elevation also carry the leading apostrophe on negatives (not only Body Battery Drain); the same one-apostrophe rule is applied to them.
- Time can be "mm:ss.s" (8 rows) as well as "hh:mm:ss(.s)"; both handled. Best Lap Time / Moving Time can be "--:--:--" (null).
- Three timestamps occur twice in the real file (simultaneous activities); both rows kept.
- Strict import: any cell that fails to parse blocks the whole file (all or none). Real file has 0 parse errors.
- Recent view window = 28 days ending on the latest imported activity date (not today's date), so it equals the handoff window.
- Layout at 390 px: week labels and activity lines wrap (readable, not broken); disabled import button has low contrast.
- vite build empties dist/; in this build session deletes were not permitted, so the final verification build used --emptyOutDir false.
- Keyboard navigation was not properly tested.
