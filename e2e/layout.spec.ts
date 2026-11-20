import { test, expect, chromium } from '@playwright/test';
import { auditLayout, VIEWPORTS } from './layout-audit';

// Runs once (desktop project) and drives its own contexts for every viewport.
for (const vp of VIEWPORTS) {
  test(`overlay layout on grid: ${vp.name}`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch && vp.width < 900, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${baseURL}/?year=475`);
    await page.waitForSelector('body[data-ready="1"]', { state: 'attached', timeout: 90_000 });
    await page.waitForTimeout(2500);
    if (process.env.OVERLAY_SHOT) await page.screenshot({ path: `${process.env.OVERLAY_SHOT}-${vp.name}.png`, timeout: 90_000 });
    const issues = await auditLayout(page);
    // the browse panel must also fit next to the other overlays
    await page.evaluate(() => (document.getElementById('menu-btn') as HTMLElement).offsetParent === null && document.getElementById('browse-btn')!.click());
    await page.waitForTimeout(300);
    const issuesBrowse = (await auditLayout(page)).map((s) => `[browse open] ${s}`);
    // phones: the collapsed menu must open fully inside the screen with aligned rows
    let issuesMenu: string[] = [];
    if (await page.locator('#menu-btn').isVisible()) {
      await page.locator('#menu-btn').click();
      await page.waitForTimeout(300);
      if (process.env.OVERLAY_SHOT) await page.screenshot({ path: `${process.env.OVERLAY_SHOT}-${vp.name}-menu.png`, timeout: 90_000 });
      issuesMenu = (await auditLayout(page)).filter((s) => /outside|row|clipped/.test(s)).map((s) => `[menu open] ${s}`);
    }
    const all = [...issues, ...issuesBrowse, ...issuesMenu];
    if (all.length) console.log(`${vp.name}:\n  ${all.join('\n  ')}`);
    await ctx.close();
    expect(all).toEqual([]);
  });
}
void chromium;
