import { expect, test } from '@playwright/test';
import { idle, openApp, prefix, shot, trackErrors, writePerf } from './helpers';

test('phone portrait: globe, menu, era bar and layer switch', async ({ page }) => {
  test.setTimeout(300_000);
  const errs = trackErrors(page);
  const ms = await openApp(page);
  writePerf(`${prefix()}mobile_ready`, { readyMs: ms });
  await expect(page.locator('#year')).toHaveText('475년');
  await expect(page.locator('#hud-tr')).toBeHidden();
  await shot(page, `${prefix()}mobile_globe`);
  await page.locator('#menu-btn').tap();
  await expect(page.locator('#hud-tr')).toBeVisible();
  await shot(page, `${prefix()}mobile_menu`);
  await page.selectOption('#layer-sel', 'dust');
  await expect(page.locator('#hud-tr')).toBeHidden();
  await expect(page.locator('#panel')).toContainText('황사');
  await idle(page, 5000);
  await shot(page, `${prefix()}mobile_dust`);
  await page.locator('#menu-btn').tap();
  await page.selectOption('#layer-sel', 'geo');
  await page.locator('#eras .btn', { hasText: '통일신라' }).tap();
  await expect(page.locator('#year')).toHaveText('735년');
  await idle(page, 6000);
  await shot(page, `${prefix()}mobile_unified_silla`);
  expect(errs).toEqual([]);
});

test('phone landscape layout stays usable', async ({ page }) => {
  const errs = trackErrors(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await openApp(page, '?year=1592');
  await expect(page.locator('#slider')).toBeVisible();
  await expect(page.locator('#eras')).toBeVisible();
  await shot(page, `${prefix()}mobile_landscape`);
  expect(errs).toEqual([]);
});
