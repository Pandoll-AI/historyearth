// Close the strip between a source polygon's coarse coastline and the real
// (Natural Earth 10m) coast. Land left uncovered after clipping is split into
// pieces; a piece joins the polity that owns most of its land-side edge if it
// is thin (coastal strip) or small, and a small offshore island joins the
// nearest polity within 30 km. Large unclaimed interiors stay empty.
import fs from 'node:fs';
import path from 'node:path';
import * as turf from '@turf/turf';

const key = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
const ringsOf = (g) => (g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []);

export function fillCoastGaps(features, landPath, ms, tmp) {
  const featPath = path.join(tmp, 'gapfeat.json');
  fs.writeFileSync(featPath, JSON.stringify({ type: 'FeatureCollection', features }));
  const raw = JSON.parse(ms(['-i', landPath, '-erase', featPath, '-explode', '-filter-slivers', 'min-area=5km2', '-o', 'format=geojson', 'precision=0.001', '-']).toString());
  const gaps = (raw.features || raw.geometries.map((g) => ({ type: 'Feature', properties: {}, geometry: g }))).filter((g) => g.geometry);
  // Vertex -> owning feature, plus a coarse grid of vertices for the island rule.
  const owner = new Map();
  const grid = new Map();
  features.forEach((f, i) => {
    if (!f.geometry) return;
    for (const r of ringsOf(f.geometry)) for (const p of r) {
      owner.set(key(p), i);
      const gk = `${Math.floor(p[0] * 4)},${Math.floor(p[1] * 4)}`;
      let l = grid.get(gk); if (!l) grid.set(gk, (l = [])); l.push(i, p);
    }
  });
  const add = new Map();
  for (const g of gaps) {
    const areaKm2 = turf.area(g) / 1e6;
    const rs = ringsOf(g.geometry);
    const count = new Map(); let total = 0, matched = 0;
    for (const r of rs) for (const p of r) { total++; const o = owner.get(key(p)); if (o !== undefined) { matched++; count.set(o, (count.get(o) || 0) + 1); } }
    let target = -1;
    if (matched >= 3) {
      const [best, n] = [...count].sort((a, b) => b[1] - a[1])[0];
      const perimKm = turf.length(turf.polygonToLine(turf.polygon([rs[0]])));
      const meanWidth = (2 * areaKm2) / Math.max(1, perimKm);
      if (n / matched >= 0.7 && (areaKm2 < 8000 || meanWidth < 40)) target = best;
    } else if (areaKm2 < 3000) {
      // Island: nearest polity vertex within ~30 km.
      const c = turf.centroid(g).geometry.coordinates;
      let bd = 30, bi = -1;
      for (const r of rs) for (const p of r.filter((_, k) => k % 5 === 0)) {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const l = grid.get(`${Math.floor(p[0] * 4) + dx},${Math.floor(p[1] * 4) + dy}`); if (!l) continue;
          for (let k = 0; k < l.length; k += 2) { const d = turf.distance(p, l[k + 1]); if (d < bd) { bd = d; bi = l[k]; } }
        }
      }
      void c; target = bi;
    }
    if (target >= 0) { let l = add.get(target); if (!l) add.set(target, (l = [])); l.push(g); }
  }
  let merged = 0;
  for (const [i, gs] of add) {
    try {
      const u = turf.union(turf.featureCollection([features[i], ...gs]));
      if (u) { features[i] = { ...features[i], geometry: u.geometry }; merged += gs.length; }
    } catch { /* keep the feature unchanged if the union fails */ }
  }
  return { features, gaps: gaps.length, merged };
}
