// Build compact runtime data under public/data from data-raw/ (downloaded public datasets)
// and scripts/korea-polygons.mjs (own work). Run: npm run data
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as turf from '@turf/turf';
import { nameKo } from './name-ko.mjs';
import { KOREA, LINE_38, LINE_DMZ } from './korea-polygons.mjs';
import { buildRefIndex, refineTopology } from './refine-borders.mjs';
import { splitMing1400 } from './ming-1400.mjs';
import { fillCoastGaps } from './fill-coast-gaps.mjs';

const RAW = 'data-raw';
const OUT = 'public/data';
fs.mkdirSync(path.join(OUT, 'borders'), { recursive: true });
const ms = (args) => execFileSync('npx', ['mapshaper', ...args], { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 29 });
const round = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;
// Saturated atlas palette (distinct hues, readable over relief)
const PALETTE = ['#e07b39', '#5fae4e', '#4a7fd6', '#e3c03a', '#a160d0', '#2fb3a6', '#d9534f', '#94b83a', '#c98a4b', '#3fa3df', '#d0619a', '#7f9fd9', '#e39b5a', '#53c27f'];
const TMP = fs.mkdtempSync('/tmp/he-data-');
// Detailed land mask (Natural Earth 10m land, public domain): coastlines for clipping
const LAND = path.join(TMP, 'land.json');
// Douglas-Peucker 1 km: chosen in docs/SIMPLIFY_EXPERIMENT.md (D-026).
ms(['-i', path.join(RAW, 'ne_10m_land.geojson'), '-simplify', 'dp', 'interval=1000', 'keep-shapes', '-filter-islands', 'min-area=30km2', '-o', 'format=geojson', 'precision=0.001', LAND]);
const LAND_KR = path.join(TMP, 'land-kr.json');
ms(['-i', path.join(RAW, 'ne_10m_land.geojson'), '-clip', 'bbox=115,30,140,50', '-simplify', 'dp', 'interval=1000', 'keep-shapes', '-filter-islands', 'min-area=40km2', '-dissolve', '-o', 'format=geojson', 'precision=0.001', LAND_KR]);
const hash = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
const KOREAN_NAMES = new Set(['Koguryo', 'Paekche', 'Silla', 'Gaya', 'Balhae', 'Korea', 'Paleo-Koreans', 'Korea (USA)', 'Korea (USSR)', 'Gojoseon', 'Joseon', 'Goryeo', 'Koryo', 'Puyo', 'Buyeo', 'Chin', 'Mahan', 'Jinhan', 'Byeonhan', 'Lelang']);

function largestPolygon(geom) {
  if (geom.type === 'Polygon') return turf.polygon(geom.coordinates);
  let best = null, bestA = -1;
  for (const c of geom.coordinates) { const p = turf.polygon(c); const a = turf.area(p); if (a > bestA) { bestA = a; best = p; } }
  return best;
}
function labelPoint(geom) {
  const p = largestPolygon(geom);
  try { return turf.pointOnFeature(p).geometry.coordinates; } catch { return turf.centroid(p).geometry.coordinates; }
}
function roundGeom(g, fn = round) {
  const r = (c) => (typeof c[0] === 'number' ? [fn(c[0]), fn(c[1])] : c.map(r));
  return { type: g.type, coordinates: r(g.coordinates) };
}

// Name corrections where a source snapshot carries over an older name.
const FIXES = [
  { n: 'Sui Empire', from: 618, to: 907, k: '당' },
  { n: 'Jin', from: 265, to: 316, k: '서진' },
  { n: 'Jin', from: 317, to: 420, k: '동진' },
  { n: 'Shogun Japan (Kamakura)', from: 1336, to: 1573, k: '일본(무로마치 막부)' },
];

// Reference lines for snapping: Natural Earth 10m land borders + larger rivers (public domain)
const REF = (() => {
  const lines = [];
  const add = (fc) => { for (const f of fc.features) { const g = f.geometry; if (!g) continue; if (g.type === 'LineString') lines.push(g.coordinates); else if (g.type === 'MultiLineString') lines.push(...g.coordinates); } };
  add(JSON.parse(fs.readFileSync(path.join(RAW, 'ne_10m_admin_0_boundary_lines_land.geojson'))));
  add(JSON.parse(ms(['-i', path.join(RAW, 'ne_10m_rivers_lake_centerlines.geojson'), '-filter', 'scalerank <= 7', '-o', 'format=geojson', '-']).toString()));
  return buildRefIndex(lines);
})();

// 1) Historical world snapshots (aourednik/historical-basemaps, GPL-3.0)
const files = fs.readdirSync(RAW).filter((f) => /^world_(bc)?\d+\.geojson$/.test(f));
const years = [];
const snapshots = new Map();
for (const f of files) {
  const tag = f.match(/^world_(.+)\.geojson$/)[1];
  const year = tag.startsWith('bc') ? -Number(tag.slice(2)) : Number(tag);
  // Shared-arc topology -> smooth, densify, snap to 10m modern borders/rivers -> clip to 10m land.
  const topoPath = path.join(TMP, 'topo.json'), refPath = path.join(TMP, 'refined.json');
  ms(['-i', path.join(RAW, f), '-filter', 'NAME != null', '-simplify', 'interval=3000', 'keep-shapes', '-clean', 'snap-interval=0.01', '-o', 'format=topojson', 'no-quantization', topoPath]);
  const topo = JSON.parse(fs.readFileSync(topoPath));
  fs.writeFileSync(refPath, JSON.stringify({ type: 'FeatureCollection', features: refineTopology(topo, Object.keys(topo.objects)[0], REF) }));
  const simplified = JSON.parse(ms(['-i', refPath, '-clean', '-clip', LAND, '-clean', '-filter-slivers', 'min-area=20km2', '-simplify', 'dp', 'interval=1000', 'keep-shapes', '-o', 'format=geojson', 'precision=0.001', '-']).toString());
  if (year === 1400) simplified.features = splitMing1400(simplified.features, REF);
  // Source coasts are coarse: hand the strip up to the real coast to the adjacent polity.
  const filled = fillCoastGaps(simplified.features.filter((f) => f.geometry), LAND, ms, TMP);
  // One more topology pass over the filled set: removes the seams and redundant points of the unions.
  const filledPath = path.join(TMP, 'filled.json');
  fs.writeFileSync(filledPath, JSON.stringify({ type: 'FeatureCollection', features: filled.features }));
  // Final clip to the same land mask (D-028): DP may push a coastal vertex up to ~1 km off
  // the coast; clipping again keeps every fill on land while inland borders stay as they are.
  simplified.features = JSON.parse(ms(['-i', filledPath, '-clean', '-simplify', 'dp', 'interval=1000', 'keep-shapes', '-clip', LAND, '-clean', '-filter-slivers', 'min-area=2km2', '-o', 'format=geojson', 'precision=0.001', '-']).toString()).features;
  const feats = [];
  for (const ft of simplified.features) {
    if (!ft.geometry) continue;
    const n = ft.properties.NAME; const subj = ft.properties.SUBJECTO || n;
    const area = turf.area(ft) / 1e6;
    const [lx, ly] = labelPoint(ft.geometry);
    const kr = KOREAN_NAMES.has(n) || (lx > 124 && lx < 131.5 && ly > 33 && ly < 43.2) ? 1 : 0;
    // Fix a known naming slip in the source: China around 700 is Tang, not Sui.
    const kName = FIXES.find((x) => x.n === n && year >= x.from && year <= x.to)?.k ?? nameKo(n);
    feats.push({ type: 'Feature', geometry: roundGeom(ft.geometry, round3), properties: { n, k: kName, s: nameKo(subj), a: Math.round(area), lx: round(lx), ly: round(ly), kr, c: PALETTE[hash(subj) % PALETTE.length] } });
  }
  snapshots.set(year, feats);
  years.push(year);
}
// Ming founded 1368: the corrected 1400 map also serves 1368-1399 (the 1300 map shows Yuan).
if (snapshots.has(1400)) { snapshots.set(1368, structuredClone(snapshots.get(1400))); years.push(1368); }
years.sort((a, b) => a - b);

// 2) Modern borders + labels (Natural Earth, public domain)
const innerRaw = JSON.parse(ms(['-i', path.join(RAW, 'ne_10m_admin_0_boundary_lines_land.geojson'), '-simplify', 'interval=800', '-o', 'format=geojson', 'precision=0.002', '-']).toString());
const inner = turf.featureCollection((innerRaw.features || innerRaw.geometries.map((g) => ({ type: 'Feature', geometry: g }))).map((f) => ({ type: 'Feature', properties: {}, geometry: f.geometry || f })));
fs.writeFileSync(path.join(OUT, 'modern-borders.json'), JSON.stringify(inner));
const ctry = JSON.parse(fs.readFileSync(path.join(RAW, 'ne_110m_admin_0_countries.geojson')));
const modernLabels = ctry.features.filter((f) => f.properties.LABELRANK <= 4).map((f) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [round(f.properties.LABEL_X), round(f.properties.LABEL_Y)] },
  properties: { k: f.properties.NAME_KO || f.properties.NAME, r: f.properties.LABELRANK },
}));
fs.writeFileSync(path.join(OUT, 'modern-labels.json'), JSON.stringify({ type: 'FeatureCollection', features: modernLabels }));

// 3) Rivers (Natural Earth 10m, public domain): major rivers worldwide, more detail in East Asia
const riverExpr = '(scalerank <= 4) || (scalerank <= 9 && $.bounds[0] > 100 && $.bounds[2] < 145 && $.bounds[1] > 20 && $.bounds[3] < 55)';
const rivers = JSON.parse(ms(['-i', path.join(RAW, 'ne_10m_rivers_lake_centerlines.geojson'), '-filter', `featurecla == "River" && (${riverExpr})`, '-simplify', 'interval=2000', '-o', 'format=geojson', 'precision=0.005', '-']).toString());
rivers.features.forEach((f) => { f.properties = { n: nameKo(f.properties.name || ''), r: f.properties.scalerank }; });
fs.writeFileSync(path.join(OUT, 'rivers.json'), JSON.stringify(rivers));
console.log('rivers', rivers.features.length);

// 4) Korean polities overlay (own polygons clipped to land)
const landKr = JSON.parse(fs.readFileSync(LAND_KR));
const landFeats = landKr.features || landKr.geometries.map((g) => turf.feature(g));
let land = landFeats.length === 1 ? landFeats[0] : turf.union(turf.featureCollection(landFeats));
land = turf.truncate(land, { precision: 3 });
const halfPlane = (line, north) => turf.polygon([[...line, north ? [131, 50] : [131, 30], north ? [123.5, 50] : [123.5, 30], line[0]]]);
const CLIPS = { south38: halfPlane(LINE_38, false), north38: halfPlane(LINE_38, true), southDmz: halfPlane(LINE_DMZ, false), northDmz: halfPlane(LINE_DMZ, true) };
const byId = Object.fromEntries(KOREA.map((k) => [k.id, k]));
function baseShape(k) {
  const ring = k.ring || (k.sameAs && byId[k.sameAs].ring) || byId['joseon-2'].ring;
  let p = turf.polygon([[...ring, ring[0]]]);
  if (k.clip) p = turf.intersect(turf.featureCollection([p, CLIPS[k.clip]]));
  const r = turf.intersect(turf.featureCollection([p, land]));
  return r && turf.truncate(r, { precision: 3 });
}
const shapes = Object.fromEntries(KOREA.map((k) => [k.id, baseShape(k)]));
const cuts = new Set();
KOREA.forEach((k) => { cuts.add(k.from); cuts.add(k.to + 1); });
const bounds = [...cuts].sort((a, b) => a - b);
const out = [];
const open = new Map(); // id -> feature being extended
for (let i = 0; i < bounds.length - 1; i++) {
  const a = bounds[i], b = bounds[i + 1] - 1;
  const active = KOREA.filter((k) => k.from <= a && k.to >= b).sort((x, y) => x.prio - y.prio);
  let taken = null;
  const seen = new Set();
  for (const k of active) {
    let g = shapes[k.id];
    if (g && taken) g = turf.difference(turf.featureCollection([g, taken]));
    if (g) g = turf.truncate(g, { precision: 3 });
    if (g) taken = turf.truncate(taken ? turf.union(turf.featureCollection([taken, g])) : g, { precision: 3 });
    if (!g || turf.area(g) < 2e8) continue;
    const geom = roundGeom(g.geometry, round3);
    const key = k.id + JSON.stringify(geom);
    seen.add(k.id);
    const prev = open.get(k.id);
    if (prev && prev.key === key && prev.f.properties.to === a - 1) { prev.f.properties.to = b; continue; }
    const [lx, ly] = labelPoint(geom);
    const f = { type: 'Feature', geometry: geom, properties: { id: k.id, k: k.name, c: k.color, from: a, to: b, lx: round(lx), ly: round(ly) } };
    out.push(f); open.set(k.id, { key, f });
  }
}
fs.writeFileSync(path.join(OUT, 'korea.json'), JSON.stringify({ type: 'FeatureCollection', features: out }));
console.log('korea features', out.length);

// 5) Write world snapshots. Where the own Korean overlay is shown, cut the world
// polygons away so the two layers never double-overlap.
for (const [i, year] of years.entries()) {
  const end = (years[i + 1] ?? 10000) - 1;
  const kr = out.filter((f) => f.properties.from <= end && f.properties.to >= year);
  let mask = null;
  for (const f of kr) mask = mask ? turf.union(turf.featureCollection([mask, f])) : f;
  const mbox = mask && turf.bbox(mask);
  const feats = [];
  for (const ft of snapshots.get(year)) {
    if (mask && ft.properties.kr !== 1) {
      const b = turf.bbox(ft);
      if (!(b[2] < mbox[0] || b[0] > mbox[2] || b[3] < mbox[1] || b[1] > mbox[3])) {
        const d = turf.difference(turf.featureCollection([ft, mask]));
        if (!d || turf.area(d) < 2e8) continue;
        ft.geometry = roundGeom(d.geometry, round3);
      }
    }
    feats.push(ft);
  }
  fs.writeFileSync(path.join(OUT, 'borders', `${year}.json`), JSON.stringify({ type: 'FeatureCollection', features: feats }));
}
fs.writeFileSync(path.join(OUT, 'borders', 'index.json'), JSON.stringify({ years }));
console.log('snapshots', years.length);
fs.rmSync(TMP, { recursive: true, force: true });
