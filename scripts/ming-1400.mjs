// Own correction for the 1400 snapshot. The source still carries the 1300 Yuan
// ("Great Khanate") polygon; here it is split into Ming, Northern Yuan and the
// Jurchen lands. Frontier lines are drawn for this project from textbook maps of
// the early Ming (Hongwu–Yongle): the Gansu corridor to Jiayu Pass, the Ordos
// loop, Datong/Xuanfu, Kaiping and Daning, and the Liaodong frontier to the Yalu.
import * as turf from '@turf/turf';
import { refineArc } from './refine-borders.mjs';

// Northern frontier of Ming, west -> east (lon, lat).
const MING_NORTH = [
  [96.6, 40.4], [98.3, 40.1], [100.2, 39.6], [102.3, 39.1], [104.0, 38.6], [105.8, 39.2],
  [106.9, 40.3], [108.6, 40.9], [110.6, 41.0], [112.3, 41.3], [114.2, 41.9], [116.2, 42.6],
  [118.4, 42.4], [120.4, 42.4], [122.3, 42.9], [124.1, 43.1], [125.2, 42.1], [125.0, 41.0], [124.3, 39.7],
];
// Southern/western closure well outside the Yuan polygon on sea and Tibet sides.
const MING_CLOSE = [[124.0, 30.0], [122.0, 18.0], [96.0, 18.0], [96.0, 30.0], [101.6, 35.6], [101.0, 37.3], [99.6, 38.2], [98.0, 39.0], [96.9, 39.8], [96.6, 40.4]];
// Jurchen lands: west edge along the Greater Khingan; the south edge is the Ming frontier.
const JURCHEN_WEST = [[120.4, 42.4], [120.6, 44.0], [121.1, 46.6], [120.2, 49.4], [121.3, 52.6], [122.5, 58.0]];
const JURCHEN_CLOSE = [[145.0, 58.0], [145.0, 40.0], [124.0, 38.0], [120.4, 42.4]];

const props = (NAME) => ({ NAME, SUBJECTO: NAME });

export function splitMing1400(features, ref) {
  const opt = { snapKm: 10, stepKm: 4, minRun: 4, smooth: 4 };
  const ming = turf.polygon([[...refineArc(MING_NORTH, ref, opt), ...MING_CLOSE]]);
  const jur = turf.difference(turf.featureCollection([turf.polygon([[...refineArc(JURCHEN_WEST, ref, opt), ...JURCHEN_CLOSE]]), ming]));
  const out = [];
  for (const f of features) {
    const n = f.properties?.NAME;
    if (n === 'Tibet') { out.push({ ...f, properties: props('Tibet') }); continue; }
    if (n === 'Hainan') { out.push({ ...f, properties: props('Ming Chinese Empire') }); continue; }
    if (n !== 'Great Khanate') { out.push(f); continue; }
    const m = turf.intersect(turf.featureCollection([f, ming]));
    const j = jur && turf.intersect(turf.featureCollection([f, jur]));
    let y = turf.difference(turf.featureCollection([f, ming]));
    if (y && j) y = turf.difference(turf.featureCollection([y, j]));
    if (m) out.push({ type: 'Feature', geometry: m.geometry, properties: props('Ming Chinese Empire') });
    if (j) out.push({ type: 'Feature', geometry: j.geometry, properties: props('Jurchens') });
    if (y) out.push({ type: 'Feature', geometry: y.geometry, properties: props('Northern Yuan') });
  }
  return out;
}
