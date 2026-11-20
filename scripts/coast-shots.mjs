import { chromium } from '@playwright/test';
const [url, out, cams] = [process.argv[2], process.argv[3], JSON.parse(process.argv[4])];
const pre = process.argv[6] || '';
const vp = process.argv[5] === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: vp });
await p.goto(url);
await p.waitForSelector('body[data-ready="1"]', { state: 'attached', timeout: 120000 });
await p.waitForTimeout(5000);
if (pre) await p.evaluate(pre);
for (const [name, cam] of Object.entries(cams)) {
  await p.evaluate((cam) => { const m = window.__he.map; m.stop(); m.jumpTo(cam); }, cam);
  await p.evaluate(() => new Promise((r) => { const m = window.__he.map; let done = false; m.once('idle', () => { done = true; r(); }); setTimeout(() => r(), 60000); }));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}_${name}.png` });
  console.log('shot', name);
}
await b.close();
