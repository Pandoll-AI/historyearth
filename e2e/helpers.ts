import type { Page } from '@playwright/test';
import fs from 'node:fs';

export const SHOTS = 'docs/screenshots';
export function trackErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  return errs;
}
export async function openApp(page: Page, query = ''): Promise<number> {
  const t0 = Date.now();
  await page.goto(`/${query}`);
  await page.waitForSelector('body[data-ready="1"]', { state: 'attached', timeout: 90_000 });
  const ms = Date.now() - t0;
  await page.waitForTimeout(4500); // initial fly-in
  return ms;
}
export async function idle(page: Page, ms = 4000): Promise<void> {
  await page.waitForTimeout(ms);
}
export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 90_000 });
}
export function writePerf(key: string, value: unknown): void {
  const f = 'docs/perf.json';
  const cur = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  cur[key] = value;
  fs.writeFileSync(f, JSON.stringify(cur, null, 2));
}
export async function fps(page: Page, seconds = 5): Promise<number> {
  return page.evaluate((s) => new Promise<number>((res) => {
    let n = 0; const t0 = performance.now();
    const f = (): void => { n++; if (performance.now() - t0 < s * 1000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); };
    requestAnimationFrame(f);
  }), seconds);
}
export const prefix = (): string => (process.env.E2E_URL ? 'live_' : '');
