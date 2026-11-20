// Refine coarse historical borders on a shared-arc topology so neighbours stay gap-free:
// 1) round off corners (Chaikin), 2) densify, 3) snap runs that lie close to a
// Natural Earth 10m modern border or river onto that line, following its vertices.
// Coast-only arcs are left alone; the caller clips the result to the 10m land mask.

const DEG_KM = 111.2;

/** Build a grid index of reference line segments. */
export function buildRefIndex(lines, cell = 0.25) {
  const grid = new Map();
  const key = (i, j) => i * 100000 + j;
  lines.forEach((pts, li) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [x1, y1] = pts[s], [x2, y2] = pts[s + 1];
      const i0 = Math.floor(Math.min(x1, x2) / cell) - 1, i1 = Math.floor(Math.max(x1, x2) / cell) + 1;
      const j0 = Math.floor(Math.min(y1, y2) / cell) - 1, j1 = Math.floor(Math.max(y1, y2) / cell) + 1;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(li, s);
      }
    }
  });
  return { lines, grid, cell, key };
}

/** Nearest reference point within maxKm, or null. Planar with cos(lat) scaling. */
function nearest(idx, p, maxKm) {
  const a = idx.grid.get(idx.key(Math.floor(p[0] / idx.cell), Math.floor(p[1] / idx.cell)));
  if (!a) return null;
  const c = Math.cos((p[1] * Math.PI) / 180);
  let best = null, bd = (maxKm / DEG_KM) ** 2;
  for (let n = 0; n < a.length; n += 2) {
    const li = a[n], s = a[n + 1], pts = idx.lines[li];
    const ax = pts[s][0] * c, ay = pts[s][1], bx = pts[s + 1][0] * c, by = pts[s + 1][1];
    const px = p[0] * c, py = p[1];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx, qy = ay + t * dy, d = (px - qx) ** 2 + (py - qy) ** 2;
    if (d < bd) { bd = d; best = { li, s, t, pt: [qx / c, qy] }; }
  }
  return best;
}

function chaikin(pts, iters) {
  for (let k = 0; k < iters; k++) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      if (i > 0) out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1]);
      if (i < pts.length - 2) out.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function densify(pts, stepKm) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const c = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
    const km = Math.hypot((x1 - x0) * c, y1 - y0) * DEG_KM;
    const n = Math.max(1, Math.ceil(km / stepKm));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

/** Refine one arc (array of [lon,lat]); endpoints are kept fixed. */
export function refineArc(arc, idx, { snapKm = 14, stepKm = 5, minRun = 4, smooth = 3 } = {}) {
  let pts = densify(chaikin(arc, smooth), stepKm);
  const hits = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? null : nearest(idx, p, snapKm)));
  // Keep only runs of consecutive hits on the same reference line.
  for (let i = 0; i < hits.length;) {
    if (!hits[i]) { i++; continue; }
    let j = i; while (j + 1 < hits.length && hits[j + 1] && hits[j + 1].li === hits[i].li) j++;
    if (j - i + 1 < minRun) for (let k = i; k <= j; k++) hits[k] = null;
    i = j + 1;
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const h = hits[i];
    out.push(h ? h.pt : pts[i]);
    const h2 = hits[i + 1];
    if (h && h2 && h.li === h2.li && h.s !== h2.s && Math.abs(h2.s - h.s) < 400) {
      const L = idx.lines[h.li];
      if (h2.s > h.s) for (let s = h.s + 1; s <= h2.s; s++) out.push(L[s]);
      else for (let s = h.s; s > h2.s; s--) out.push(L[s]);
    }
  }
  return out;
}

/** Refine a non-quantized TopoJSON object in place and return GeoJSON features. */
export function refineTopology(topo, objName, idx, opts) {
  const obj = topo.objects[objName];
  const use = new Map();
  const count = (ring) => ring.forEach((a) => { const i = a < 0 ? ~a : a; use.set(i, (use.get(i) || 0) + 1); });
  for (const g of obj.geometries) {
    if (g.type === 'Polygon') g.arcs.forEach(count);
    else if (g.type === 'MultiPolygon') g.arcs.forEach((p) => p.forEach(count));
  }
  // Only borders between two polygons are refined; single-use arcs are coasts or edges.
  const arcs = topo.arcs.map((a, i) => (use.get(i) >= 2 && a.length >= 2 ? refineArc(a, idx, opts) : a));
  const ring = (r) => {
    const out = [];
    for (const a of r) {
      const src = a < 0 ? arcs[~a].slice().reverse() : arcs[a];
      out.push(...(out.length ? src.slice(1) : src));
    }
    if (out.length && (out[0][0] !== out.at(-1)[0] || out[0][1] !== out.at(-1)[1])) out.push(out[0]);
    return out;
  };
  return obj.geometries.filter((g) => g.arcs).map((g) => ({
    type: 'Feature', properties: g.properties || {},
    geometry: g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.arcs.map(ring) } : { type: 'MultiPolygon', coordinates: g.arcs.map((p) => p.map(ring)) },
  }));
}
