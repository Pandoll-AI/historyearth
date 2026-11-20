// Temperature grid helpers and the colour scale used by the heatmap and legend.
export interface TempGrid { step: number; lons: number[]; lats: number[]; jan: (number | null)[]; jul: (number | null)[] }
export type TempMode = 'jan' | 'jul' | 'range';

export const TEMP_MIN = -30;
export const TEMP_MAX = 30;

function cell(g: TempGrid, arr: (number | null)[], i: number, j: number): number | null {
  const nx = g.lons.length;
  const ii = ((i % nx) + nx) % nx;
  const jj = Math.min(g.lats.length - 1, Math.max(0, j));
  return arr[jj * nx + ii];
}

/** Bilinear interpolation on the global grid (lats descending, lons ascending, wraps in lon). */
export function sample(g: TempGrid, mode: TempMode, lon: number, lat: number): number | null {
  const fx = (lon - g.lons[0]) / g.step;
  const fy = (g.lats[0] - lat) / g.step;
  const i0 = Math.floor(fx), j0 = Math.floor(fy);
  const tx = fx - i0, ty = fy - j0;
  const val = (i: number, j: number): number | null => {
    if (mode === 'range') {
      const a = cell(g, g.jan, i, j), b = cell(g, g.jul, i, j);
      return a == null || b == null ? null : Math.abs(b - a);
    }
    return cell(g, mode === 'jan' ? g.jan : g.jul, i, j);
  };
  const v00 = val(i0, j0), v10 = val(i0 + 1, j0), v01 = val(i0, j0 + 1), v11 = val(i0 + 1, j0 + 1);
  if (v00 == null || v10 == null || v01 == null || v11 == null) return v00 ?? v10 ?? v01 ?? v11 ?? null;
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

const STOPS: Array<[number, [number, number, number]]> = [
  [-30, [74, 20, 140]], [-20, [48, 70, 200]], [-10, [60, 150, 230]], [0, [190, 235, 245]],
  [10, [140, 210, 110]], [20, [250, 200, 60]], [30, [215, 40, 30]],
];

/** Map a temperature (or for 'range', a yearly range 0..60 mapped onto -30..30) to RGB. */
export function tempColor(t: number): [number, number, number] {
  const x = Math.min(TEMP_MAX, Math.max(TEMP_MIN, t));
  for (let k = 0; k < STOPS.length - 1; k++) {
    const [a, ca] = STOPS[k], [b, cb] = STOPS[k + 1];
    if (x <= b) {
      const f = (x - a) / (b - a);
      return [0, 1, 2].map((i) => Math.round(ca[i] + (cb[i] - ca[i]) * f)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export const rangeToScale = (r: number): number => r - 30;

/** Latitude for row `j` of an image whose rows are evenly spaced in Web Mercator y. */
export function mercatorRowLat(j: number, rows: number, maxLat = 85): number {
  const yMax = Math.log(Math.tan(Math.PI / 4 + (maxLat * Math.PI) / 360));
  const y = yMax - ((j + 0.5) / rows) * 2 * yMax;
  return (Math.atan(Math.sinh(y)) * 180) / Math.PI;
}
