import { expect, test } from '@playwright/test';
import { fps, idle, openApp, prefix, shot, trackErrors, writePerf } from './helpers';

test('globe loads with year, era, Seoul badge and no console errors', async ({ page }) => {
  const errs = trackErrors(page);
  const ms = await openApp(page);
  await expect(page.locator('#year')).toHaveText('475년');
  await expect(page.locator('#era-badge')).toHaveText('한국: 삼국 시대');
  await expect(page.locator('#seoul-badge')).toContainText('서울');
  await expect(page.locator('.lbl.kr', { hasText: '고구려' })).toBeVisible();
  await idle(page, 3000);
  const f = await fps(page, 5);
  writePerf(`${prefix()}desktop_globe`, { readyMs: ms, fpsIdle: Math.round(f * 10) / 10, note: 'headless Chromium + SwiftShader (software GL, no GPU)' });
  await shot(page, `${prefix()}desktop_globe`);
  expect(errs).toEqual([]);
});

test('timeline slider updates year, era and borders', async ({ page }) => {
  const errs = trackErrors(page);
  await openApp(page);
  await page.locator('#slider').fill('1450');
  await expect(page.locator('#year')).toHaveText('1450년');
  await expect(page.locator('#era-badge')).toHaveText('한국: 조선 전기');
  await page.click('#korea-btn');
  await idle(page, 6000);
  await expect(page.locator('.lbl.kr', { hasText: '조선' })).toBeVisible();
  await shot(page, `${prefix()}desktop_1450_korea`);
  await page.locator('#slider').fill('-2999');
  await expect(page.locator('#year')).toHaveText('기원전 3000년');
  await expect(page.locator('#era-badge')).toHaveText('한국: 선사 시대');
  await page.click('#world-btn');
  await idle(page, 6000);
  await expect(page.locator('.lbl.band:visible').first()).toBeVisible();
  await shot(page, `${prefix()}desktop_bc3000_world`);
  expect(errs).toEqual([]);
});

test('era button flies to Goguryeo peak with three kingdoms coloured', async ({ page }) => {
  const errs = trackErrors(page);
  await openApp(page, '?year=1000');
  await page.locator('#eras .btn', { hasText: '고구려 전성기' }).click();
  await expect(page.locator('#year')).toHaveText('475년');
  await idle(page, 6000);
  for (const n of ['고구려', '백제', '신라']) await expect(page.locator('.lbl.kr', { hasText: n }).first()).toBeAttached();
  const center = await page.evaluate(() => (window as any).__he.map.getCenter());
  expect(center.lng).toBeGreaterThan(120); expect(center.lng).toBeLessThan(132);
  await shot(page, `${prefix()}desktop_era_goguryeo`);
  expect(errs).toEqual([]);
});

test('search finds Hansando and plays the battle scene', async ({ page }) => {
  const errs = trackErrors(page);
  await openApp(page);
  await page.fill('#search', '한산도');
  await expect(page.locator('#search-results button').first()).toContainText('한산도 대첩');
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel h3')).toContainText('한산도 대첩');
  await expect(page.locator('#year')).toHaveText('1592년');
  await idle(page, 17000);
  await expect(page.locator('#b-stage')).toContainText(/학익진|화포/);
  await shot(page, `${prefix()}desktop_battle_hansando`);
  await page.click('#b-close');
  await page.fill('#search', '황산벌');
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel')).toContainText('논산시 연산면');
  await idle(page, 14000);
  await shot(page, `${prefix()}desktop_battle_hwangsanbeol`);
  expect(errs).toEqual([]);
});

test('climate layers: monsoon, dust, temperature', async ({ page }) => {
  const errs = trackErrors(page);
  await openApp(page);
  await page.selectOption('#layer-sel', 'monsoon');
  await expect(page.locator('#panel h3')).toHaveText('몬순(계절풍)');
  await expect(page.locator('#panel svg')).toBeVisible();
  await idle(page, 6000);
  const f = await fps(page, 5);
  await shot(page, `${prefix()}desktop_monsoon_jul`);
  await page.locator('#panel [data-m="jan"]').click();
  await expect(page.locator('#panel')).toContainText('겨울 계절풍');
  await page.locator('#lp-play').click();
  await expect(page.locator('#lp-play')).toContainText('재생');
  await idle(page, 2000);
  await shot(page, `${prefix()}desktop_monsoon_jan`);
  await page.selectOption('#layer-sel', 'dust');
  await expect(page.locator('#panel')).toContainText('미세먼지');
  await idle(page, 6000);
  await shot(page, `${prefix()}desktop_dust`);
  await page.selectOption('#layer-sel', 'temp');
  await expect(page.locator('.legend-bar')).toBeVisible();
  await idle(page, 5000);
  await shot(page, `${prefix()}desktop_temp_jan`);
  await page.locator('#panel [data-t="range"]').click();
  await page.locator('#tth').fill('10');
  await expect(page.locator('#tth-v')).toHaveText('40°C 차이');
  await idle(page, 3000);
  await shot(page, `${prefix()}desktop_temp_range`);
  writePerf(`${prefix()}desktop_particles`, { fpsMonsoon: Math.round(f * 10) / 10, note: 'software GL' });
  expect(errs).toEqual([]);
});

test('modern borders, day/night lighting, terrain exaggeration', async ({ page }) => {
  const errs = trackErrors(page);
  await openApp(page);
  await page.click('#modern-btn');
  await expect(page.locator('#modern-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.selectOption('#light-sel', 'real');
  await idle(page, 4000);
  const vis = await page.evaluate(() => (window as any).__he.map.getLayoutProperty('night-0', 'visibility'));
  expect(vis).toBe('visible');
  await shot(page, `${prefix()}desktop_modern_night`);
  await page.locator('#exag').fill('4');
  const ex = await page.evaluate(() => (window as any).__he.map.getTerrain()?.exaggeration);
  expect(ex).toBe(4);
  await page.selectOption('#light-sel', 'night');
  await idle(page, 2000);
  expect(errs).toEqual([]);
});
