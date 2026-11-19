/* global process, fetch, setTimeout, localStorage, document, innerWidth, window */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url).pathname;
const output = new URL('../docs/home-preview/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
  cwd: root, stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_EQFIT_OWNER_ID: '' },
});
const origin = 'http://127.0.0.1:5173';
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* Vite is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin + '/?today=2026-11-18');
    await page.getByRole('button', { name: /Start lifting/ }).waitFor();
    await page.evaluate(async () => {
      const { RecompDB } = await import('/src/db/db.ts');
      const { Repo } = await import('/src/db/repo.ts');
      const repo = await Repo.open(new RecompDB());
      const bench = await repo.createExercise('Bench press', 'Barbell', ['Chest']);
      const row = await repo.createExercise('One-arm dumbbell row with a deliberately long exercise name', 'Dumbbell', ['Back']);
      for (const [date, reps] of [['2026-11-12', 8], ['2026-11-16', 9]]) {
        const workout = await repo.createWorkout({ date, name: 'Upper body', kind: 'weights' });
        await repo.updateWorkout(workout.id, { status: 'done', planned_exercise_ids: [bench.id, row.id] });
        await repo.addSet(workout.id, bench.id, { load_kg: 80, reps, rir: null, warmup: false, pain_note: null });
      }
      // Synthetic watch activities use the existing tables. No production connection is configured.
      for (const [id, date, type, km, seconds, pace] of [
        ['run-a', '2026-11-16', 'Running', 5, 1800, 360],
        ['run-b', '2026-11-18', 'Running', 6.2, 2108, 340],
        ['unlabelled', '2026-11-18', 'Cardio', null, 2100, null],
        ['walk', '2026-11-17', 'Walking', 2, 1500, null],
      ]) {
        await repo.db.activities.add({
          id, date, timestamp_local: date + ' 06:30:00', title: type, original_type: type,
          distance_km: km, duration_seconds: seconds, avg_pace_sec_per_km: pace,
          owner_id: null, batch_id: 'synthetic', dedupe_key: id, raw_fields: {}, raw_row: [],
        });
      }
      localStorage.setItem('eqfit.coach.v1:recomp', JSON.stringify({
        tone: 'off', seen: [], recent: [], dismissed: [], consent: false, feedback: [],
      }));
      // Explicit preview label belongs only to this synthetic QA browser.
      repo.db.close();
    });
    await page.reload();
    await page.getByRole('button', { name: /Repeat Upper body/ }).waitFor();
    const syncNote = page.getByRole('button', { name: 'Got it', exact: true });
    if (await syncNote.count()) await syncNote.click();
    await page.evaluate(() => {
      const label = document.createElement('p');
      label.textContent = 'SYNTHETIC PREVIEW DATA';
      label.style.cssText = 'position:sticky;top:0;z-index:9999;margin:0;padding:4px 12px;font:700 11px system-ui;color:#fff;background:#333;text-align:center';
      document.body.prepend(label);
    });
    // Open the native theme chooser through its summary.
    const chooser = page.locator('.home-designs');
    await chooser.locator('summary').click();
    for (const theme of ['Pit Lane', 'Front Page', 'After Hours']) {
      await page.getByRole('button', { name: theme, exact: true }).click();
      await chooser.locator('summary').click();
      const filename = theme.toLowerCase().replaceAll(' ', '-');
      await page.evaluate(() => window.scrollTo(0, 0));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      await page.screenshot({ path: output + 'dashboard-' + filename + '-' + width + '.png', fullPage: false });
      await page.getByRole('button', { name: /^Save session$/ }).waitFor();
      assert.equal(await page.locator('.training-run-totals > div').first().locator('strong').innerText(), '11.2');
      assert.equal(await page.locator('.training-run-totals > div').last().locator('strong').innerText(), '5:49');
      const progress = page.locator('.home-experience > .home-secondary');
      await progress.locator(':scope > summary').click();
      const week = page.getByRole('button', { name: /^This week/ });
      await week.click();
      await page.getByRole('button', { name: 'Open weekly history →', exact: true }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Expanded card overflow');
      await page.screenshot({ path: output + filename + '-' + width + '-expanded.png', fullPage: false });
      const running = page.getByRole('button', { name: /^Running recorded distance/ });
      await running.click();
      await page.waitForFunction(() => {
        const button = [...document.querySelectorAll('.home-card-header')].find(el => el.textContent.startsWith('Running'));
        const bounds = button?.getBoundingClientRect();
        return bounds && bounds.top >= 0 && bounds.top < 780;
      });
      const runningBounds = await running.boundingBox();
      assert(runningBounds && runningBounds.y >= 0 && runningBounds.y < 780, 'Tapped header moved out of view');
      assert.equal(await week.evaluate(button => document.activeElement === button), false);
      assert.equal(await week.getAttribute('aria-expanded'), 'false');
      await page.getByRole('button', { name: 'Open running history →', exact: true }).click();
      await page.getByRole('button', { name: 'Today', exact: true }).click();
      await page.locator('.home-experience > .home-secondary > summary').click();
      await page.getByRole('button', { name: /^Strength working sets/ }).click();
      await page.getByRole('heading', { name: 'Max day', exact: true }).waitFor();
      await page.screenshot({ path: output + filename + '-' + width + '-strength.png', fullPage: false });
      await page.getByRole('button', { name: /Bench press, Barbell.*Record check-in/i }).click();
      const dialog = page.getByRole('dialog', { name: 'Bench press', exact: true });
      await dialog.getByRole('button', { name: /Save 1 completed set/ }).waitFor();
      await page.evaluate(async () => {
        const { Repo } = await import('/src/db/repo.ts');
        const original = Repo.prototype.quickLogLift;
        Repo.prototype.quickLogLift = async function () {
          Repo.prototype.quickLogLift = original;
          await new Promise(resolve => setTimeout(resolve, 750));
          throw new Error('Preview save failure. Please retry.');
        };
      });
      await dialog.getByRole('button', { name: /Save 1 completed set/ }).click();
      assert(await dialog.getByRole('button', { name: 'Saving…', exact: true }).isDisabled());
      await dialog.getByRole('alert').filter({ hasText: 'Preview save failure' }).waitFor();
      await page.screenshot({ path: output + filename + '-' + width + '-form-error.png', fullPage: false });
      await dialog.getByRole('button', { name: 'Close quick log', exact: true }).click();
      await page.getByRole('button', { name: 'Open strength history →', exact: true }).click();
      await page.getByRole('button', { name: 'Today', exact: true }).click();
      await page.locator('.home-designs summary').click();
    }
    await page.locator('.home-designs summary').click();
    const classify = page.locator('.training-classify');
    await classify.getByRole('button', { name: 'Strength', exact: true }).click();
    assert(await classify.getByRole('button', { name: 'Save session', exact: true }).isDisabled());
    await classify.getByRole('button', { name: 'Chest', exact: true }).click();
    await classify.getByRole('button', { name: 'Back', exact: true }).click();
    await classify.getByRole('button', { name: 'Save session', exact: true }).click();
    await page.getByText('Garmin sessions sorted ✓', { exact: true }).waitFor();
    assert.match(await page.locator('.training-split-totals').innerText(), /2 Strength/);
    assert.equal(await page.locator('.training-area').filter({ hasText: 'Chest' }).locator('strong').innerText(), '1');
    await page.screenshot({ path: output + 'session-sorted-' + width + '.png', fullPage: false });
    // Normal repeat -> log -> pause -> continue -> finish -> return flow.
    await page.getByRole('button', { name: /Repeat Upper body/ }).click();
    await page.getByRole('spinbutton', { name: 'Reps', exact: true }).fill('10');
    await page.getByRole('button', { name: /Log set/ }).click();
    await page.getByRole('button', { name: /Pause/ }).click();
    await page.getByRole('button', { name: /Continue workout/ }).click();
    await page.getByRole('button', { name: /Finish workout/ }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: /Repeat Upper body/ }).waitFor();
    await page.locator('.home-experience > .home-secondary > summary').click();
    await page.getByRole('button', { name: /^Strength working sets/ }).click();
    await page.getByRole('button', { name: /Bench press, Barbell.*Record check-in/i }).click();
    const checkIn = page.getByRole('dialog', { name: 'Bench press', exact: true });
    await checkIn.getByRole('spinbutton', { name: 'Reps', exact: true }).fill('11');
    await checkIn.getByRole('button', { name: /Save 1 completed set/ }).click();
    await page.locator('.pr-flag').filter({ hasText: 'New PR' }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: /Repeat Upper body/ }).waitFor();
    assert.equal(await page.locator('.pr-flag').count(), 0, 'Reload replayed a PR celebration');
    assert.equal(errors.length, 0, errors.join('\n'));
    await context.close();
  }
  await writeFile(output + 'verification.txt', 'Synthetic phone checks passed at 390×844 and 320×844. All three themes, expansion, history navigation, repeat/log/pause/continue/finish flows.\n');
} finally {
  await browser?.close();
  server.kill();
}
