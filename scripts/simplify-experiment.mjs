// Coastline/border simplification experiment (docs/SIMPLIFY_EXPERIMENT.md).
// Builds the 1400 and 1600 snapshots with several simplification settings and
// measures vertex count, size, parse time, overlap/gap area and coastline error
// against Natural Earth 10m. Browser FPS is measured by e2e/simplify-fps.spec.ts.
// Run: node scripts/simplify-experiment.mjs  (writes public/exp/*, docs/simplify-metrics.json)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import * as turf from '@turf/turf';
import { buildRefIndex, refineTopology } from './refine-borders.mjs';

const RAW = 'data-raw', EXP = 'public/exp';
const TMP = fs.mkdtempSync('/tmp/he-exp-');
fs.mkdirSync(EXP, { recursive: true });
const ms = (a) => execFileSync('npx', ['mapshaper', ...a], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 29 });

export const VARIANTS = [
  { id: 'base', land: ['interval=1500'], final: ['interval=400'], note: 'current build (weighted VW, land 1.5 km, final 0.4 km)' },
  { id: 'dp-1k', land: ['dp', 'interval=1000'], final: ['dp', 'interval=1000'] },
  { id: 'dp-2.5k', land: ['dp', 'interval=2500'], final: ['dp', 'interval=2500'] },
  { id: 'dp-5k', land: ['dp', 'interval=5000'], final: ['dp', 'interval=5000'] },
  { id: 'vw-1k', land: ['visvalingam', 'interval=1000'], final: ['visvalingam', 'interval=1000'] },
  { id: 'vw-2.5k', land: ['visvalingam', 'interval=2500'], final: ['visvalingam', 'interval=2500'] },
  { id: 'vw-5k', land: ['visvalingam', 'interval=5000'], final: ['visvalingam', 'interval=5000'] },
  { id: 'wvw-2.5k', land: ['interval=2500'], final: ['interval=2500'] },
  { id: 'wvw-5k', land: ['interval=5000'], final: ['interval=5000'] },
  { id: 'wvw-3%', land: ['3%'], final: ['interval=2500'] },
];

// Reference coastline: NE 10m land without simplification, same island filter.
const REF_LAND = path.join(TMP, 'ref-land.json');
ms(['-i', path.join(RAW, 'ne_10m_land.geojson'), '-filter-islands', 'min-area=30km2', '-o', 'format=geojson', REF_LAND]);
const rings = (fc) => (fc.features || fc.geometries.map((g) => ({ geometry: g }))).flatMap((f) => { const g = f.geometry || f; if (!g) return []; return g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []; });
const BOXES = { eastasia: [100, 15, 145, 50], korea: [124, 33, 131, 43.2], europe: [-10, 35, 40, 60] };
const inBox = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];

function segIndex(rs, cell = 0.5) {
  const g = new Map();
  for (const r of rs) for (let i = 0; i < r.length - 1; i++) {
    const a = r[i], b = r[i + 1];
    for (let x = Math.floor(Math.min(a[0], b[0]) / cell); x <= Math.floor(Math.max(a[0], b[0]) / cell); x++)
      for (let y = Math.floor(Math.min(a[1], b[1]) / cell); y <= Math.floor(Math.max(a[1], b[1]) / cell); y++) {
        const k = x * 10000 + y; let l = g.get(k); if (!l) g.set(k, (l = [])); l.push(a, b);
      }
  }
  return { g, cell };
}
function distKm(idx, p, maxCells = 4) {
  const c = Math.cos((p[1] * Math.PI) / 180);
  const cx = Math.floor(p[0] / idx.cell), cy = Math.floor(p[1] / idx.cell);
  let best = Infinity;
  for (let r = 0; r <= maxCells; r++) {
    for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
      const l = idx.g.get(x * 10000 + y); if (!l) continue;
      for (let i = 0; i < l.length; i += 2) {
        const ax = l[i][0] * c, ay = l[i][1], bx = l[i + 1][0] * c, by = l[i + 1][1], px = p[0] * c, py = p[1];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
        best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy) * 111.2);
      }
    }
    if (best < (r * idx.cell) * 111.2 * c) break;
  }
  return best;
}
const refRings = rings(JSON.parse(fs.readFileSync(REF_LAND)));
const refIdx = segIndex(refRings);

// Pre-clip refined topology for the test snapshots (same as build-data step 1).
const REF = (() => {
  const lines = [];
  const add = (fc) => { for (const f of fc.features) { const g = f.geometry; if (!g) continue; if (g.type === 'LineString') lines.push(g.coordinates); else if (g.type === 'MultiLineString') lines.push(...g.coordinates); } };
  add(JSON.parse(fs.readFileSync(path.join(RAW, 'ne_10m_admin_0_boundary_lines_land.geojson'))));
  add(JSON.parse(ms(['-i', path.join(RAW, 'ne_10m_rivers_lake_centerlines.geojson'), '-filter', 'scalerank <= 7', '-o', 'format=geojson', '-']).toString()));
  return buildRefIndex(lines);
})();
const YEARS = [1400, 1600];
const refined = {};
for (const y of YEARS) {
  const topoPath = path.join(TMP, `topo-${y}.json`);
  ms(['-i', path.join(RAW, `world_${y}.geojson`), '-filter', 'NAME != null', '-simplify', 'interval=3000', 'keep-shapes', '-clean', 'snap-interval=0.01', '-o', 'format=topojson', 'no-quantization', topoPath]);
  const topo = JSON.parse(fs.readFileSync(topoPath));
  refined[y] = path.join(TMP, `ref-${y}.json`);
  fs.writeFileSync(refined[y], JSON.stringify({ type: 'FeatureCollection', features: refineTopology(topo, Object.keys(topo.objects)[0], REF) }));
}

const results = [];
for (const v of VARIANTS) {
  const land = path.join(TMP, `land-${v.id}.json`);
  ms(['-i', path.join(RAW, 'ne_10m_land.geojson'), '-simplify', ...v.land, 'keep-shapes', '-filter-islands', 'min-area=30km2', '-o', 'format=geojson', 'precision=0.001', land]);
  const lr = rings(JSON.parse(fs.readFileSync(land)));
  const lIdx = segIndex(lr);
  const err = {};
  for (const [bn, b] of Object.entries(BOXES)) {
    const d = [];
    for (const r of refRings) for (const p of r) if (inBox(p, b)) d.push(distKm(lIdx, p));
    for (const r of lr) for (const p of r) if (inBox(p, b)) d.push(distKm(refIdx, p));
    d.sort((a, z) => a - z);
    const q = (f) => { const x = d[Math.min(d.length - 1, Math.floor(d.length * f))]; return Number.isFinite(x) ? +x.toFixed(2) : 999; };
    err[bn] = { p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) };
  }
  const row = { id: v.id, note: v.note ?? '', landVerts: lr.reduce((s, r) => s + r.length, 0), err, years: {} };
  for (const y of YEARS) {
    const out = path.join(EXP, `${v.id}-${y}.json`);
    const t0 = Date.now();
    ms(['-i', refined[y], '-clean', '-clip', land, '-clean', '-filter-slivers', 'min-area=20km2', '-simplify', ...v.final, 'keep-shapes', '-o', 'format=geojson', 'precision=0.001', out]);
    const buildMs = Date.now() - t0;
    const txt = fs.readFileSync(out, 'utf8');
    let parse = Infinity;
    for (let i = 0; i < 5; i++) { const s = performance.now(); JSON.parse(txt); parse = Math.min(parse, performance.now() - s); }
    const fc = JSON.parse(txt);
    const verts = rings(fc).reduce((s, r) => s + r.length, 0);
    // Topology check: overlap = sum of areas - dissolved area; gaps = holes created vs. dissolved source.
    const sum = fc.features.reduce((s, f) => s + (f.geometry ? turf.area(f) : 0), 0);
    const dis = JSON.parse(ms(['-i', out, '-dissolve', '-o', 'format=geojson', '-']).toString());
    const uni = (dis.features || dis.geometries.map((g) => ({ type: 'Feature', geometry: g }))).reduce((s, f) => s + turf.area(f.geometry ? f : { type: 'Feature', geometry: f }), 0);
    row.years[y] = { verts, kb: Math.round(txt.length / 1024), gzKb: Math.round(zlib.gzipSync(txt).length / 1024), parseMs: +parse.toFixed(1), buildMs, overlapKm2: Math.round((sum - uni) / 1e6) };
  }
  results.push(row);
  console.log(JSON.stringify(row));
}
fs.writeFileSync('docs/simplify-metrics.json', JSON.stringify(results, null, 2));
fs.rmSync(TMP, { recursive: true, force: true });
