import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

// Region shots for border quality review: set BORDER_SHOT=<prefix> (e.g. 2355-after).
const SHOT = process.env.BORDER_SHOT;
const REGIONS = {
  eastasia: { center: [118, 38], zoom: 3.6 },
  europe_me: { center: [30, 42], zoom: 3.2 },
} as const;

async function setYear(page: Page, year: number): Promise<void> {
  await page.evaluate((y) => (window as any).__he.store.set({ year: y }), year);
}
async function labelTexts(page: Page): Promise<string[]> {
  return page.$$eval('#overlay .labels .lbl:not(.gone) .txt', (els) => els.map((e) => e.textContent ?? ''));
}

test('borders: Korean-only labels, own 1400 Ming/Northern Yuan split', async ({ page }) => {
  await openApp(page, '?year=1400&fade=0');
  await page.waitForTimeout(1500);
  const t1400 = await labelTexts(page);
  expect(t1400).toEqual(expect.arrayContaining(['명', '북원']));
  for (const y of [475, 700, 1450, 1600, 1914]) {
    await setYear(page, y);
    await page.waitForTimeout(1500);
    const t = await labelTexts(page);
    expect(t.length).toBeGreaterThan(10);
    expect(t.filter((x) => /[A-Za-z]/.test(x)), `year ${y}`).toEqual([]);
  }
  const hedge = await page.evaluate(() => document.body.innerText + (document.querySelector('.maplibregl-ctrl-attrib')?.textContent ?? ''));
  expect(hedge).not.toMatch(/대략|어림/);
});

test('borders: year change crossfades fills, lines and labels', async ({ page }) => {
  await openApp(page, '?year=475&fade=8000');
  await page.evaluate(() => (window as any).__he.map.jumpTo({ center: [118, 38], zoom: 3.6 }));
  await page.waitForTimeout(3500);
  await setYear(page, 700);
  // The fade starts once the 700 snapshot is loaded; sample it mid-way in one page call.
  let mid: { cur: number; prev: number; fill: unknown; gone: number } | null = null;
  for (let i = 0; i < 60 && !mid; i++) {
    mid = await page.evaluate(() => {
      const m = (window as any).__he.map;
      const cur = m.getPaintProperty('hist-line', 'line-opacity'), prev = m.getPaintProperty('hist-line-prev', 'line-opacity');
      if (!(cur > 0.1 && cur < 0.8)) return null;
      return { cur, prev, fill: m.getPaintProperty('hist-fill', 'fill-opacity'), gone: document.querySelectorAll('#overlay .labels .lbl.gone').length };
    });
    if (!mid) await page.waitForTimeout(150);
  }
  if (!mid) throw new Error('no mid-fade frame observed');
  expect(mid.cur).toBeGreaterThan(0.05);
  expect(mid.cur).toBeLessThan(0.85);
  expect(mid.prev).toBeGreaterThan(0.05);
  expect(mid.prev).toBeLessThan(0.85);
  expect(Array.isArray(mid.fill)).toBe(true);
  expect(mid.gone).toBeGreaterThan(0);
  if (SHOT) await page.screenshot({ path: `docs/screenshots/progress/${SHOT}-fade-mid-475to700.png`, timeout: 90_000 });
  await page.waitForTimeout(9000);
  const end = await page.evaluate(() => (window as any).__he.map.getPaintProperty('hist-line-prev', 'line-opacity'));
  expect(end).toBe(0);
});

test('borders: region screenshots', async ({ page }) => {
  test.skip(!SHOT, 'set BORDER_SHOT to capture');
  await openApp(page, '?year=475&fade=0');
  for (const [name, cam] of Object.entries(REGIONS)) {
    for (const y of [475, 700, 1450]) {
      await setYear(page, y);
      await page.evaluate((c) => (window as any).__he.map.jumpTo(c), cam as any);
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `docs/screenshots/progress/${SHOT}-${name}-${y}.png`, timeout: 90_000 });
    }
  }
});
