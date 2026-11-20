// Fetch a coarse global grid of monthly-mean 2 m temperature (Jan & Jul 2024)
// from the Open-Meteo historical archive (ERA5 reanalysis, CC BY 4.0). No API key needed.
import fs from 'node:fs';
const STEP = 6;
const lons = []; const lats = [];
for (let x = -177; x <= 177; x += STEP) lons.push(x);
for (let y = 84; y >= -84; y -= STEP) lats.push(y);
const pts = [];
for (const la of lats) for (const lo of lons) pts.push([lo, la]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function month(start, end) {
  const out = new Array(pts.length).fill(null);
  for (let i = 0; i < pts.length; i += 100) {
    const chunk = pts.slice(i, i + 100);
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${chunk.map((p) => p[1]).join(',')}&longitude=${chunk.map((p) => p[0]).join(',')}&start_date=${start}&end_date=${end}&daily=temperature_2m_mean&timezone=GMT`;
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch(url);
      if (res.ok) {
        let js = await res.json(); if (!Array.isArray(js)) js = [js];
        js.forEach((r, k) => {
          const v = r.daily.temperature_2m_mean.filter((t) => t != null);
          out[i + k] = v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
        });
        break;
      }
      console.error('retry', res.status, await res.text()); await sleep(15000 * (attempt + 1));
    }
    console.error(start, i); await sleep(1500);
  }
  return out;
}
const jan = await month('2024-01-01', '2024-01-31');
const jul = await month('2024-07-01', '2024-07-31');
fs.writeFileSync('public/data/temperature.json', JSON.stringify({ source: 'Open-Meteo Historical Weather API (ERA5), monthly mean of daily mean 2 m temperature, 2024', step: STEP, lons, lats, jan, jul }));
console.error('done');
