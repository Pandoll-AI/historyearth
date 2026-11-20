#!/usr/bin/env python3
"""Coast-fit checker (deterministic). Compares every territory polygon and the
displayed basemap against Natural Earth 10m land (the coast source of the build).

Checks
  V1  polygon area outside NE 10m land (km2, ratio)                      [vector]
  V2  boundary points at sea: distance to the NE coastline (max/p95/p99) [vector]
  V3  coastal land gaps between polygons (uncovered land touching coast) [vector]
  R1  basemap: Blue Marble (zoom 6, ~2.4 km px) sea pixels that look like land
      (brown/green turbid water), clustered; covered or not by sea-fix.json [raster]

Usage
  python3 scripts/check-coast-fit.py [--vector] [--raster] [--build-seafix]
         [--data public/data] [--out docs/coast-fit] [--years 1200,1400]
Output: <out>.json and <out>-report.md (ranked offenders). Exit code 1 when a
threshold in THRESHOLDS is exceeded (used by tests/coast-fit.test.ts).
"""
import argparse, concurrent.futures as cf, io, json, math, os, sys, urllib.request
import numpy as np
import shapely
from shapely.geometry import shape, box, mapping
from shapely.strtree import STRtree

RAW = 'data-raw'
TILE_DIR = os.path.join(RAW, 'bm6')
BM = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'
Z = 6
THRESHOLDS = {
    'sea_p95_km': 1.0,          # every polygon: p95 distance of its at-sea boundary points to the coast
    'sea_max_km': 5.0,          # every polygon: worst at-sea boundary point
    'sea_ratio': 0.025,         # every polygon (>2000 km2): share of its area over the sea (DP 1 km on small islands ~1-2%)
    'basemap_residual_km2': 500.0,  # all land-looking sea clusters (>=3 km off the coast) not hidden by sea-fix
}

def km_xy(lon0, lat0):
    c = math.cos(math.radians(lat0))
    return lambda xy: np.column_stack([(xy[:, 0] - lon0) * 111.32 * c, xy[:, 1] * 110.57])

def area_km2(g):
    if g.is_empty: return 0.0
    def f(xy):  # sinusoidal (equal-area)
        return np.column_stack([xy[:, 0] * 111.32 * np.cos(np.radians(xy[:, 1])), xy[:, 1] * 110.57])
    return float(shapely.transform(g, f).area)

_LAND = None
def land():
    global _LAND
    if _LAND is None:
        fc = json.load(open(os.path.join(RAW, 'ne_10m_land.geojson')))
        parts = []
        for f in fc['features']:
            g = shape(f['geometry'])
            parts.extend(getattr(g, 'geoms', [g]))
        parts = [shapely.make_valid(p) for p in parts]
        _LAND = (parts, STRtree(parts))
    return _LAND

def land_in(bounds, pad=0.2):
    parts, tree = land()
    b = (bounds[0] - pad, bounds[1] - pad, bounds[2] + pad, bounds[3] + pad)
    idx = tree.query(box(*b))
    if len(idx) == 0: return shapely.Polygon()
    return shapely.union_all([shapely.clip_by_rect(parts[i], *b) for i in idx])

# ---------------------------------------------------------------- vector
def coast_segments(L, bounds, tf):
    """Coastline of L near bounds as 2-point segments in local km."""
    C = shapely.clip_by_rect(L.boundary, *bounds)
    out = []
    for ln in getattr(C, 'geoms', [C]):
        if ln.is_empty: continue
        xy = tf(shapely.get_coordinates(ln))
        if len(xy) < 2: continue
        out.append(shapely.linestrings(np.stack([xy[:-1], xy[1:]], axis=1)))
    return np.concatenate(out) if out else np.array([])
def check_feature(geom):
    g = shapely.make_valid(shape(geom))
    if g.is_empty: return None
    a = area_km2(g)
    L = land_in(g.bounds)
    sea = g.difference(L) if not L.is_empty else g
    sea_a = area_km2(sea)
    # boundary points every ~1 km
    bnd = shapely.segmentize(g.boundary, 0.01)
    pts = shapely.get_coordinates(bnd)
    at_sea = ~shapely.contains_xy(L, pts[:, 0], pts[:, 1]) if not L.is_empty else np.ones(len(pts), bool)
    # points on the coast itself count as on land (tolerance 50 m)
    d = np.zeros(0); worst = None
    if at_sea.any():
        sp = pts[at_sea]
        tf = km_xy(float(np.mean(sp[:, 0])), float(np.mean(sp[:, 1])))
        segs = coast_segments(L, g.buffer(0.3).bounds, tf)
        if len(segs):
            tree = STRtree(segs)
            _, dist = tree.query_nearest(shapely.points(tf(sp)), return_distance=True, all_matches=False)
            keep = dist > 0.05
            d = dist[keep]
            if len(d): worst = sp[keep][int(np.argmax(d))].tolist()
    return {
        'area_km2': round(a, 1), 'sea_km2': round(sea_a, 1), 'sea_ratio': round(sea_a / a, 5) if a else 0,
        'boundary_pts': int(len(pts)), 'sea_pts': int(len(d)),
        'sea_max_km': round(float(d.max()), 2) if len(d) else 0.0,
        'sea_p95_km': round(float(np.percentile(d, 95)), 2) if len(d) else 0.0,
        'sea_p99_km': round(float(np.percentile(d, 99)), 2) if len(d) else 0.0,
        'worst': [round(worst[0], 3), round(worst[1], 3)] if worst else None,
    }

DISPLAY_LAND = '/tmp/he-coastfit-land.json'
def ensure_display_land():
    import subprocess
    if not os.path.exists(DISPLAY_LAND):
        subprocess.run(['npx', 'mapshaper', '-i', os.path.join(RAW, 'ne_10m_land.geojson'), '-simplify', 'dp', 'interval=1000', 'keep-shapes',
                        '-filter-islands', 'min-area=30km2', '-o', 'format=geojson', 'precision=0.001', DISPLAY_LAND + '.tmp'], check=True, capture_output=True)
        os.replace(DISPLAY_LAND + '.tmp', DISPLAY_LAND)
    return DISPLAY_LAND

def coastal_gaps(feats, label):
    """Land of the displayed coast (DP 1 km land) left uncovered next to a polity:
    thin strips (mean width >= 1 km) or pieces up to 5000 km2 touching the coast."""
    import subprocess, tempfile
    fp = os.path.join(tempfile.gettempdir(), f'he-cf-{os.getpid()}-{label}.json')
    json.dump({'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {}, 'geometry': f['geometry']} for f in feats]}, open(fp, 'w'))
    raw = subprocess.run(['npx', 'mapshaper', '-i', ensure_display_land(), '-erase', fp, '-explode', '-filter-slivers', 'min-area=5km2',
                          '-o', 'format=geojson', 'precision=0.001', '-'], check=True, capture_output=True).stdout
    os.remove(fp)
    fc = json.loads(raw)
    pieces = [shape(f['geometry'] if 'geometry' in f else f) for f in (fc.get('features') or fc.get('geometries') or []) if (f.get('geometry') if 'type' in f and f['type'] == 'Feature' else f)]
    polys = [shapely.make_valid(shape(f['geometry'])) for f in feats]
    ptree = STRtree(polys)
    out = []
    for q in pieces:
        if q.is_empty: continue
        a = area_km2(q)
        if a < 5 or a > 5000: continue
        near = ptree.query(q.buffer(0.005))
        if not any(polys[i].distance(q) < 0.005 for i in near): continue
        perim = q.length * 111 * math.cos(math.radians(q.centroid.y))
        w = 2 * a / max(perim, 1)
        if w < 1.0: continue  # DP-1km slivers
        rp = q.representative_point()
        out.append({'km2': round(a, 1), 'mean_width_km': round(w, 1), 'at': [round(rp.x, 2), round(rp.y, 2)]})
    return out

def run_snapshot(args):
    path, label, extra = args
    fc = json.load(open(path))
    feats = fc['features'] + extra
    rows = []
    for f in feats:
        r = check_feature(f['geometry'])
        if r is None: continue
        r.update({'snapshot': label, 'name': f['properties'].get('k') or f['properties'].get('n')})
        rows.append(r)
    gaps = coastal_gaps(feats, label)
    return label, rows, gaps

def vector(data, years_filter=None):
    years = json.load(open(os.path.join(data, 'borders', 'index.json')))['years']
    korea = json.load(open(os.path.join(data, 'korea.json')))['features']
    jobs = []
    for i, y in enumerate(years):
        if years_filter and y not in years_filter: continue
        end = (years[i + 1] if i + 1 < len(years) else 10000) - 1
        kr = [f for f in korea if f['properties']['from'] <= end and f['properties']['to'] >= y]
        jobs.append((os.path.join(data, 'borders', f'{y}.json'), y, kr))
    rows, gaps = [], {}
    ensure_display_land()
    with cf.ProcessPoolExecutor(max_workers=min(8, os.cpu_count() or 2)) as ex:
        for label, r, g in ex.map(run_snapshot, jobs):
            rows += r; gaps[label] = g
            print(f'  vector {label}: {len(r)} polygons, {len(g)} coastal gaps', file=sys.stderr)
    return rows, gaps

# ---------------------------------------------------------------- raster
def tile_ll(x, y, z=Z):
    n = 256 * 2 ** z
    px = np.arange(256) + 0.5
    lon = (x * 256 + px) / n * 360 - 180
    Y = (y * 256 + px) / n
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * Y))))
    return lon, lat

def tile_bounds(x, y, z=Z):
    n = 2 ** z
    lon0, lon1 = x / n * 360 - 180, (x + 1) / n * 360 - 180
    lat = lambda t: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * t / n))))
    return lon0, lat(y + 1), lon1, lat(y)

def coastal_tiles():
    parts, tree = land()
    out = []
    for y in range(2 ** Z):
        b = tile_bounds(0, y)
        if b[1] > 72 or b[3] < -60: continue
        for x in range(2 ** Z):
            tb = box(*tile_bounds(x, y))
            idx = tree.query(tb)
            if any(parts[i].boundary.intersects(tb) for i in idx): out.append((x, y))
    return out

def get_tile(xy):
    x, y = xy
    p = os.path.join(TILE_DIR, f'{Z}_{x}_{y}.jpg')
    if not os.path.exists(p):
        os.makedirs(TILE_DIR, exist_ok=True)
        for k in range(4):
            try:
                data = urllib.request.urlopen(BM.format(z=Z, x=x, y=y), timeout=60).read(); break
            except Exception:
                if k == 3: raise
        open(p, 'wb').write(data)
    return p

def classify(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    bright = np.maximum(np.maximum(r, g), b) >= 45   # very dark pixels are deep water (trenches)
    return bright & ((r >= b - 8) | (g > b + 12))   # brown / green: looks like land

def raster(tiles, seafix=None):
    """Returns per-cluster rows. Clusters are labelled on a mosaic of the coastal tiles."""
    from PIL import Image
    from scipy import ndimage
    xs = sorted({t[0] for t in tiles}); ys = sorted({t[1] for t in tiles})
    with cf.ThreadPoolExecutor(16) as ex: list(ex.map(get_tile, tiles))
    y0, y1 = ys[0], ys[-1]
    H, W = (y1 - y0 + 1) * 256, 2 ** Z * 256
    flag = np.zeros((H, W), bool); isl = np.zeros((H, W), bool)
    rgb = {}
    parts, tree = land()
    fixmask = None
    if seafix is not None:
        fixmask = np.zeros((H, W), bool)
        fixcore = shapely.union_all([shape(f['geometry']) for f in seafix['features'] if f['properties'].get('o', 1) >= 0.85])
        fixcore = shapely.make_valid(fixcore)
    def work(t):
        x, y = t
        a = np.asarray(Image.open(os.path.join(TILE_DIR, f'{Z}_{x}_{y}.jpg')).convert('RGB'))
        lon, lat = tile_ll(x, y)
        LON, LAT = np.meshgrid(lon, lat)
        L = land_in(tile_bounds(x, y), 0.05)
        il = shapely.contains_xy(L, LON, LAT) if not L.is_empty else np.zeros((256, 256), bool)
        fm = None
        if fixmask is not None:
            C = shapely.clip_by_rect(fixcore, *tile_bounds(x, y))
            fm = shapely.contains_xy(C, LON, LAT) if not C.is_empty else np.zeros((256, 256), bool)
        return t, a, il, fm
    with cf.ThreadPoolExecutor(8) as ex:
        for (x, y), a, il, fm in ex.map(work, tiles):
            sl = (slice((y - y0) * 256, (y - y0 + 1) * 256), slice(x * 256, (x + 1) * 256))
            isl[sl] = il
            flag[sl] = classify(a) & ~il
            if fm is not None: fixmask[sl] = fm
            rgb[(x, y)] = a
    # ignore the 1-pixel mixed fringe: keep clusters that have pixels >=2 px off the coast
    core = ndimage.binary_erosion(flag, iterations=1) & ~ndimage.binary_dilation(isl, iterations=1)
    lab, n = ndimage.label(flag, structure=np.ones((3, 3)))
    keep = np.unique(lab[core]); keep = keep[keep > 0]
    objs = ndimage.find_objects(lab)
    n_world = 2 ** Z * 256
    rows = []
    for k in keep:
        sl = objs[k - 1]
        sub = lab[sl] == k
        yy, xx = np.nonzero(sub)
        gy = yy + sl[0].start + y0 * 256; gx = xx + sl[1].start
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (gy + 0.5) / n_world))))
        pkm = 40075.0 / n_world * np.cos(np.radians(lat))
        a = float(np.sum(pkm ** 2))
        if a < 20: continue
        # distance from coast (pixels -> km) inside the cluster window
        win = (slice(max(0, sl[0].start - 40), sl[0].stop + 40), slice(max(0, sl[1].start - 40), sl[1].stop + 40))
        dist = ndimage.distance_transform_edt(~isl[win])
        dd = dist[(lab[win] == k)] * float(np.mean(pkm))
        resid = 0.0
        if fixmask is not None:
            m = (lab[win] == k) & ~fixmask[win] & (dist * float(np.mean(pkm)) >= 3.0)
            ry = np.nonzero(m)[0] + win[0].start + y0 * 256
            rl = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (ry + 0.5) / n_world))))
            resid = float(np.sum((40075.0 / n_world * np.cos(np.radians(rl))) ** 2))
        lon_c = float(np.mean(gx) + 0.5) / n_world * 360 - 180
        rows.append({'km2': round(a), 'max_km': round(float(dd.max()), 1), 'p95_km': round(float(np.percentile(dd, 95)), 1),
                     'at': [round(lon_c, 2), round(float(np.mean(lat)), 2)], 'label': int(k), 'residual_km2': round(resid)})
    rows.sort(key=lambda r: -r['km2'])
    return rows, (lab, keep, isl, flag, y0, rgb)

# ---------------------------------------------------------------- sea fix
def build_seafix(state, rows, display_land):
    """Hide land-looking water: per cluster, a flat polygon in the colour of the
    clean water around it, ending exactly at the displayed coast, with two
    feather rings (opacity 0.55 / 0.25)."""
    from scipy import ndimage
    lab, keep, isl, flag, y0, rgb = state
    n_world = 2 ** Z * 256
    def px2ll(xy):
        lon = xy[:, 0] / n_world * 360 - 180
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (xy[:, 1] + y0 * 256) / n_world))))
        return np.column_stack([lon, lat])
    def color_at(gy, gx):
        t = (gx // 256, gy // 256 + y0)
        a = rgb.get(t)
        return None if a is None else a[gy % 256, gx % 256]
    feats = []
    objs = ndimage.find_objects(lab)
    for r in rows:
        k = r['label']; sl = objs[k - 1]
        win = (slice(max(0, sl[0].start - 12), sl[0].stop + 12), slice(max(0, sl[1].start - 12), sl[1].stop + 12))
        m = lab[win] == k
        m = ndimage.binary_closing(m, iterations=2)
        m = ndimage.binary_fill_holes(m | isl[win]) & (m | ~isl[win])
        grown = ndimage.binary_dilation(m, iterations=2)
        ring = ndimage.binary_dilation(m, iterations=7) & ~ndimage.binary_dilation(m, iterations=3) & ~isl[win] & ~flag[win]
        ys, xs = np.nonzero(ring)
        cols = [color_at(yv + win[0].start, xv + win[1].start) for yv, xv in zip(ys, xs)]
        cols = np.array([c for c in cols if c is not None])
        col = np.median(cols, axis=0) if len(cols) else np.array([24, 60, 122])
        hexc = '#%02x%02x%02x' % tuple(int(v) for v in col)
        # pixel runs -> polygons (pixel space), then lon/lat
        boxes = []
        gy, gx = np.nonzero(grown)
        for yv in np.unique(gy):
            row = np.sort(gx[gy == yv]); br = np.nonzero(np.diff(row) > 1)[0]
            starts = np.r_[row[0], row[br + 1]]; ends = np.r_[row[br], row[-1]]
            for s, e in zip(starts, ends):
                X0 = s + win[1].start; Y0 = yv + win[0].start
                boxes.append(box(X0, Y0, e + win[1].start + 1, Y0 + 1))
        P = shapely.union_all(boxes).simplify(0.7)
        P = shapely.transform(P, px2ll)
        P = shapely.make_valid(P)
        b = P.bounds
        L = shapely.clip_by_rect(display_land, b[0] - 0.5, b[1] - 0.5, b[2] + 0.5, b[3] + 0.5)
        core = shapely.make_valid(P.difference(L))
        r1 = shapely.make_valid(P.buffer(0.04, quad_segs=4).difference(P).difference(L))
        r2 = shapely.make_valid(P.buffer(0.09, quad_segs=4).difference(P.buffer(0.04, quad_segs=4)).difference(L))
        for g, o in ((core, 0.92), (r1, 0.55), (r2, 0.25)):
            g = shapely.set_precision(g, 0.001)
            g = shapely.make_valid(g)
            polys = [q for q in getattr(g, 'geoms', [g]) if q.geom_type == 'Polygon' and not q.is_empty]
            if not polys: continue
            mp = shapely.MultiPolygon(polys) if len(polys) > 1 else polys[0]
            feats.append({'type': 'Feature', 'properties': {'c': hexc, 'o': o}, 'geometry': mapping(mp)})
    return {'type': 'FeatureCollection', 'features': feats}

def display_land_geom():
    """The coast used by the build: NE 10m land, DP 1 km, islands >= 30 km2."""
    import subprocess, tempfile
    tmp = tempfile.mktemp(suffix='.json')
    subprocess.run(['npx', 'mapshaper', '-i', os.path.join(RAW, 'ne_10m_land.geojson'), '-simplify', 'dp', 'interval=1000', 'keep-shapes',
                    '-filter-islands', 'min-area=30km2', '-o', 'format=geojson', 'precision=0.001', tmp], check=True, capture_output=True)
    fc = json.load(open(tmp)); os.remove(tmp)
    gs = [shapely.make_valid(shape(f['geometry'] if 'geometry' in f else f)) for f in (fc.get('features') or fc.get('geometries'))]
    return shapely.union_all(gs)

# ---------------------------------------------------------------- report
REGIONS = [((119, 26, 124, 33), '중국 동해안(창장 하구·저장)'), ((117, 33, 127, 41), '황해·보하이'), ((66, 15, 74.5, 24.5), '인도 서해안(구자라트·캄베이만·콘칸)'),
           ((72, 8, 78, 15), '인도 남서해안(말라바르)'), ((86, 18, 93, 23), '벵골만 북부(갠지스 하구)'), ((104, 8, 110, 12), '메콩 하구'),
           ((47, 28, 51, 31), '페르시아만 북부'), ((-52, -5, -44, 4), '아마존 하구'), ((-60, -38, -54, -33), '라플라타강 하구'),
           ((105, 17, 110, 22), '통킹만'), ((94, 14, 99, 18), '이라와디 하구(미얀마)'), ((46, 44, 54, 48), '카스피해 북부'),
           ((-63, 7, -52, 11), '오리노코 하구·기아나'), ((-84, 50, -78, 56), '제임스만(허드슨만)'), ((100, -2, 106, 3), '믈라카 해협·수마트라 동안'),
           ((-140, 67, -130, 71), '매켄지 하구'), ((-168, 60, -160, 65), '유콘 하구'), ((-64, -42, -56, -37), '아르헨티나 바이아블랑카'),
           ((134, -10, 141, -5), '아라푸라해(뉴기니 남안)'), ((140, 69, 170, 74), '동시베리아해 연안'), ((60, 66, 90, 74), '오비·예니세이만'), ((-5, 30, 36, 46), '지중해'), ((124, 33, 131, 39), '한반도 연안')]
def region(at):
    for (a, b, c, d), n in REGIONS:
        if a <= at[0] <= c and b <= at[1] <= d: return n
    return f'{at[0]:.1f}°, {at[1]:.1f}°'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vector', action='store_true'); ap.add_argument('--raster', action='store_true')
    ap.add_argument('--build-seafix', action='store_true')
    ap.add_argument('--data', default='public/data'); ap.add_argument('--out', default='docs/coast-fit')
    ap.add_argument('--years', default='')
    a = ap.parse_args()
    if not (a.vector or a.raster or a.build_seafix): a.vector = a.raster = True
    years = [int(v) for v in a.years.split(',') if v] or None
    res = {'thresholds': THRESHOLDS, 'source': 'Natural Earth 10m land; NASA Blue Marble (GIBS) zoom 6'}
    fail = []
    if a.vector:
        rows, gaps = vector(a.data, years)
        big = [r for r in rows if r['area_km2'] > 2000]
        res['vector'] = {
            'polygons': len(rows), 'snapshots': len(gaps),
            'sea_km2_total': round(sum(r['sea_km2'] for r in rows)),
            'sea_p95_km_worst': max((r['sea_p95_km'] for r in rows), default=0),
            'sea_max_km_worst': max((r['sea_max_km'] for r in rows), default=0),
            'top_sea_km2': sorted(rows, key=lambda r: -r['sea_km2'])[:25],
            'top_sea_max_km': sorted(rows, key=lambda r: -r['sea_max_km'])[:25],
            'coastal_gaps_km2_total': round(sum(g['km2'] for v in gaps.values() for g in v)),
            'top_gaps': sorted([dict(g, snapshot=k) for k, v in gaps.items() for g in v], key=lambda g: -g['km2'])[:25],
        }
        for r in rows:
            if r['sea_p95_km'] > THRESHOLDS['sea_p95_km']: fail.append(f"{r['snapshot']} {r['name']} sea p95 {r['sea_p95_km']} km")
            if r['sea_max_km'] > THRESHOLDS['sea_max_km']: fail.append(f"{r['snapshot']} {r['name']} sea max {r['sea_max_km']} km at {r['worst']}")
        for r in big:
            if r['sea_ratio'] > THRESHOLDS['sea_ratio']: fail.append(f"{r['snapshot']} {r['name']} sea ratio {r['sea_ratio']}")
    if a.raster or a.build_seafix:
        tiles = coastal_tiles()
        print(f'  raster: {len(tiles)} coastal tiles (z{Z})', file=sys.stderr)
        sf_path = os.path.join(a.data, 'sea-fix.json')
        seafix = json.load(open(sf_path)) if (os.path.exists(sf_path) and not a.build_seafix) else None
        rows, state = raster(tiles, seafix)
        if a.build_seafix:
            fc = build_seafix(state, rows, display_land_geom())
            json.dump(fc, open(sf_path, 'w'), separators=(',', ':'))
            print(f'  sea-fix: {len(fc["features"])} features -> {sf_path} ({os.path.getsize(sf_path)//1024} KB)', file=sys.stderr)
            rows, state = raster(tiles, fc); seafix = fc
        for r in rows: r['region'] = region(r['at']); r.pop('label', None)
        resid = sum(r['residual_km2'] for r in rows) if seafix else sum(r['km2'] for r in rows)
        res['raster'] = {'tiles': len(tiles), 'clusters': len(rows), 'land_looking_sea_km2': sum(r['km2'] for r in rows),
                         'seafix': bool(seafix), 'residual_km2': round(resid), 'top': rows[:30]}
        if resid > THRESHOLDS['basemap_residual_km2']: fail.append(f'basemap residual {round(resid)} km2 of land-looking sea not hidden')
    res['fail'] = fail
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    json.dump(res, open(a.out + '.json', 'w'), ensure_ascii=False, indent=1)
    write_md(res, a.out + '-report.md')
    print(json.dumps({'fail': len(fail), 'first': fail[:5]}, ensure_ascii=False))
    sys.exit(1 if fail else 0)

def write_md(res, path):
    L = ['# 해안선 맞춤 검사 결과', '', f"기준: {res['source']}. 기준값: " + ', '.join(f'{k} ≤ {v}' for k, v in res['thresholds'].items()), '']
    v = res.get('vector')
    if v:
        L += ['## 나라 영역(벡터) vs NE 10m 육지', '', f"- 검사: 연도 {v['snapshots']}개, 영역 {v['polygons']}개",
              f"- 바다로 넘친 면적 합계 {v['sea_km2_total']} km², 최악 p95 {v['sea_p95_km_worst']} km, 최악 최대 {v['sea_max_km_worst']} km",
              f"- 해안 틈(덮이지 않은 해안 육지) 합계 {v['coastal_gaps_km2_total']} km²", '',
              '| 연도 | 나라 | 바다 면적 km² | 비율 | 최대 km | p95 km | p99 km | 최악 지점 |', '|---|---|---|---|---|---|---|---|']
        for r in v['top_sea_max_km'][:15]:
            L.append(f"| {r['snapshot']} | {r['name']} | {r['sea_km2']} | {r['sea_ratio']} | {r['sea_max_km']} | {r['sea_p95_km']} | {r['sea_p99_km']} | {r['worst']} |")
        L += ['', '해안 틈 상위', '', '| 연도 | km² | 평균 폭 km | 위치 |', '|---|---|---|---|']
        for g in v['top_gaps'][:10]: L.append(f"| {g['snapshot']} | {g['km2']} | {g['mean_width_km']} | {g['at']} |")
        L.append('')
    r = res.get('raster')
    if r:
        L += ['## 배경 지도(Blue Marble) vs NE 10m 해안선', '',
              f"- 해안 타일 {r['tiles']}장(줌 6, 픽셀 약 2.4km). 바다인데 육지처럼 보이는(갈색·녹색 탁한 물) 덩어리 {r['clusters']}개, {r['land_looking_sea_km2']} km²",
              f"- sea-fix 적용: {'예' if r['seafix'] else '아니오'}, 가려지지 않은 면적(해안에서 3km 이상) {r['residual_km2']} km²", '',
              '| 지역 | 면적 km² | 해안에서 최대 km | p95 km | 남은 km² | 중심 |', '|---|---|---|---|---|---|']
        for c in r['top'][:20]: L.append(f"| {c['region']} | {c['km2']} | {c['max_km']} | {c['p95_km']} | {c['residual_km2']} | {c['at']} |")
        L.append('')
    L += ['## 기준 초과', ''] + ([f'- {f}' for f in res['fail'][:40]] or ['- 없음'])
    open(path, 'w').write('\n'.join(L) + '\n')

if __name__ == '__main__':
    main()
