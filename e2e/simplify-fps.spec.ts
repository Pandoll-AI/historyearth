import { test } from '@playwright/test';
import fs from 'node:fs';
import { openApp } from './helpers';

// Simplification experiment (run only with SIMPLIFY_EXP=1 after scripts/simplify-experiment.mjs).
const RUN = process.env.SIMPLIFY_EXP;
const STAMP = process.env.SIMPLIFY_STAMP ?? 'exp';

test('simplify experiment: tiling time, FPS and screenshots per variant', async ({ page }) => {
  test.skip(!RUN, 'set SIMPLIFY_EXP=1');
  test.setTimeout(3_600_000);
  const metrics = JSON.parse(fs.readFileSync('docs/simplify-metrics.json', 'utf8'));
  await openApp(page, '?year=1600&fade=0');
  await page.evaluate(() => {
    const m = (window as any).__he.map;
    for (const id of ['korea-fill', 'korea-line', 'korea-casing']) m.setLayoutProperty(id, 'visibility', 'none');
  });
  const out: Record<string, unknown> = {};
  for (const row of metrics) {
    const id = row.id as string;
    const r: Record<string, number> = {};
    for (const [y, cam] of [[1400, { center: [118, 36], zoom: 3.4 }], [1600, { center: [15, 48], zoom: 3.4 }]] as const) {
      r[`load${y}`] = await page.evaluate(async ({ id, y, cam }) => {
        const m = (window as any).__he.map;
        m.jumpTo(cam);
        const fc = await (await fetch(`/exp/${id}-${y}.json`)).json();
        const t0 = performance.now();
        m.getSource('hist').setData(fc);
        await new Promise<void>((res) => { const done = () => res(); m.once('idle', done); setTimeout(done, 60_000); });
        return Math.round(performance.now() - t0);
      }, { id, y, cam });
      // FPS while the camera pans continuously for 6 s.
      r[`fps${y}`] = await page.evaluate(async (cam) => {
        const m = (window as any).__he.map;
        let frames = 0; const on = () => frames++;
        m.on('render', on);
        const t0 = performance.now();
        m.easeTo({ center: [cam.center[0] + 12, cam.center[1]], duration: 6000, easing: (t: number) => t });
        await new Promise((res) => setTimeout(res, 6000));
        m.off('render', on);
        m.jumpTo(cam);
        return Math.round((frames / ((performance.now() - t0) / 1000)) * 10) / 10;
      }, cam as any);
    }
    // Screenshots: East Asia (1400) and Korea zoom (1400).
    await page.evaluate(async (id) => {
      const m = (window as any).__he.map;
      m.getSource('hist').setData(await (await fetch(`/exp/${id}-1400.json`)).json());
      m.jumpTo({ center: [118, 34], zoom: 3.6 });
    }, id);
    await page.waitForTimeout(7000);
    await page.screenshot({ path: `docs/screenshots/progress/${STAMP}-simplify-${id}-eastasia.png`, timeout: 120_000 });
    await page.evaluate(() => (window as any).__he.map.jumpTo({ center: [127.3, 36.4], zoom: 6 }));
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `docs/screenshots/progress/${STAMP}-simplify-${id}-korea.png`, timeout: 120_000 });
    out[id] = r;
    console.log(id, JSON.stringify(r));
  }
  fs.writeFileSync('docs/simplify-fps.json', JSON.stringify(out, null, 2));
});
