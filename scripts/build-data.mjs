// Build compact runtime data under public/data from data-raw/ (downloaded public datasets)
// and scripts/korea-polygons.mjs (own work). Run: npm run data
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as turf from '@turf/turf';
import { nameKo } from './name-ko.mjs';
import { KOREA, LINE_38, LINE_DMZ } from './korea-polygons.mjs';

const RAW = 'data-raw';
const OUT = 'public/data';
fs.mkdirSync(path.join(OUT, 'borders'), { recursive: true });
const ms = (args) => execFileSync('npx', ['mapshaper', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
const round = (v) => Math.round(v * 100) / 100;
const PALETTE = ['#c98a5a', '#7fa36b', '#6f8fc4', '#c7b35a', '#a87cb8', '#5fb0a8', '#c96f6f', '#8a9c5a', '#b88f6a', '#6aa0c9', '#b9718f', '#88a8a0'];
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
function roundGeom(g) {
  const r = (c) => (typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(r));
  return { type: g.type, coordinates: r(g.coordinates) };
}

// 1) Historical world snapshots (aourednik/historical-basemaps, GPL-3.0)
const files = fs.readdirSync(RAW).filter((f) => /^world_(bc)?\d+\.geojson$/.test(f));
const years = [];
for (const f of files) {
  const tag = f.match(/^world_(.+)\.geojson$/)[1];
  const year = tag.startsWith('bc') ? -Number(tag.slice(2)) : Number(tag);
  const simplified = JSON.parse(ms(['-i', path.join(RAW, f), '-filter', 'NAME != null', '-simplify', '5%', 'keep-shapes', '-clean', '-o', 'format=geojson', 'precision=0.01', '-']).toString());
  const feats = [];
  for (const ft of simplified.features) {
    if (!ft.geometry) continue;
    const n = ft.properties.NAME; const subj = ft.properties.SUBJECTO || n;
    const area = turf.area(ft) / 1e6;
    const [lx, ly] = labelPoint(ft.geometry);
    const kr = KOREAN_NAMES.has(n) || (lx > 124 && lx < 131.5 && ly > 33 && ly < 43.2) ? 1 : 0;
    feats.push({ type: 'Feature', geometry: roundGeom(ft.geometry), properties: { n, k: nameKo(n), s: nameKo(subj), a: Math.round(area), lx: round(lx), ly: round(ly), kr, c: PALETTE[hash(subj) % PALETTE.length] } });
  }
  fs.writeFileSync(path.join(OUT, 'borders', `${year}.json`), JSON.stringify({ type: 'FeatureCollection', features: feats }));
  years.push(year);
}
years.sort((a, b) => a - b);
fs.writeFileSync(path.join(OUT, 'borders', 'index.json'), JSON.stringify({ years }));
console.log('snapshots', years.length);

// 2) Modern borders + labels (Natural Earth, public domain)
const innerRaw = JSON.parse(ms(['-i', path.join(RAW, 'ne_50m_admin_0_countries.geojson'), '-simplify', '20%', 'keep-shapes', '-innerlines', '-o', 'format=geojson', 'precision=0.01', '-']).toString());
const inner = turf.featureCollection((innerRaw.features || innerRaw.geometries.map((g) => ({ type: 'Feature', geometry: g }))).map((f) => ({ type: 'Feature', properties: {}, geometry: f.geometry || f })));
fs.writeFileSync(path.join(OUT, 'modern-borders.json'), JSON.stringify(inner));
const ctry = JSON.parse(fs.readFileSync(path.join(RAW, 'ne_110m_admin_0_countries.geojson')));
const modernLabels = ctry.features.filter((f) => f.properties.LABELRANK <= 4).map((f) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [round(f.properties.LABEL_X), round(f.properties.LABEL_Y)] },
  properties: { k: f.properties.NAME_KO || f.properties.NAME, r: f.properties.LABELRANK },
}));
fs.writeFileSync(path.join(OUT, 'modern-labels.json'), JSON.stringify({ type: 'FeatureCollection', features: modernLabels }));

// 3) Major rivers (Natural Earth, public domain)
const rivers = JSON.parse(ms(['-i', path.join(RAW, 'ne_50m_rivers_lake_centerlines.geojson'), '-filter', 'scalerank <= 5 && featurecla == "River"', '-simplify', '30%', '-o', 'format=geojson', 'precision=0.01', '-']).toString());
rivers.features.forEach((f) => { f.properties = { n: f.properties.name_ko || f.properties.name || '' }; });
fs.writeFileSync(path.join(OUT, 'rivers.json'), JSON.stringify(rivers));
console.log('rivers', rivers.features.length);

// 4) Korean polities overlay (own polygons clipped to land)
const landAll = JSON.parse(fs.readFileSync(path.join(RAW, 'ne_50m_land.geojson')));
const box = turf.bboxPolygon([115, 30, 140, 50]);
let land = null;
for (const f of landAll.features) {
  if (!turf.booleanIntersects(f, box)) continue;
  const c = turf.intersect(turf.featureCollection([f, box]));
  if (c) land = land ? turf.union(turf.featureCollection([land, c])) : c;
}
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
    const geom = roundGeom(g.geometry);
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
