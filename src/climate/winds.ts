// Simplified, illustrative wind fields (degrees per "step"), hand-tuned to match the
// broad textbook pattern of Asian monsoon, spring westerlies and the winter Siberian high.
// They are NOT model output; the UI labels them as simplified illustrations.
export type Vec = [number, number];
export type Box = [number, number, number, number]; // [west, south, east, north]

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function monsoonJuly(lon: number, lat: number): Vec {
  if (lon < 100) {
    // South Asia: SE trades south of the equator turn into the SW monsoon.
    if (lat < 0) return [-0.35, 0.75];
    const nearMountains = smooth(22, 29, lat);
    const u = 0.85 * (1 - nearMountains) + 0.35 * nearMountains;
    const v = 0.55 * (1 - nearMountains) + 0.05 * nearMountains;
    return [u, v];
  }
  // East Asia: southerly flow from the South China Sea and the Pacific.
  if (lat < 0) return [-0.2, 0.6];
  const north = smooth(30, 42, lat);
  return [0.2 + 0.5 * north, 0.75 * (1 - north) + 0.15];
}

export function monsoonJanuary(lon: number, lat: number): Vec {
  if (lon < 100) return [-0.7, -0.45]; // dry NE monsoon over South Asia
  const south = smooth(25, 10, lat);
  return [0.55 - 1.1 * south, -0.75]; // NW winds turning NE toward the tropics
}

export function springWesterlies(lon: number, lat: number): Vec {
  // Westerlies carrying dust east; the band sinks from ~40N over the deserts to ~36.5N
  // over Korea and Japan, as in typical spring yellow-dust events.
  const target = lon <= 100 ? 40 : lon >= 125 ? 36.5 : 40 - (lon - 100) * 0.14;
  return [1.0 + 0.3 * smooth(100, 125, lon), (target - lat) * 0.07];
}

export function siberianHigh(lon: number, lat: number): Vec {
  // Outflow from the Siberian high centred near (100E, 50N) toward Korea, Japan and China.
  const dx = lon - 100, dy = lat - 50;
  const r = Math.hypot(dx, dy) || 1;
  const out: Vec = [dx / r, dy / r];
  const nw: Vec = [0.6, -0.8];
  const w = smooth(0, 25, r);
  return [out[0] * (1 - w) * 0.6 + nw[0] * (0.4 + 0.6 * w), out[1] * (1 - w) * 0.6 + nw[1] * (0.4 + 0.6 * w)];
}

export const inBox = (lon: number, lat: number, b: Box): boolean => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];

export const SOURCES = {
  monsoonJul: [[55, 0, 72, 18], [82, 3, 95, 17], [50, -12, 95, -1], [108, 5, 122, 20], [122, 10, 145, 28]] as Box[],
  monsoonJan: [[95, 42, 130, 55], [75, 25, 95, 33]] as Box[],
  dust: [[100, 41, 112, 45.5], [78, 37, 88, 40.5]] as Box[],
  siberia: [[85, 42, 130, 60]] as Box[],
};

// Places where July monsoon air is forced up and rains (orographic + changma front).
export const RAIN_ZONES: Box[] = [[74, 25.5, 96, 30], [72.5, 9, 75.8, 20], [89, 23, 96, 27], [112, 29, 142, 36]];
