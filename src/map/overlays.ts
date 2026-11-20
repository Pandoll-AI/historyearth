import type maplibregl from 'maplibre-gl';
import { mercatorRowLat, sample, tempColor, rangeToScale, type TempGrid, type TempMode } from '../climate/temperature';

type Corners = [[number, number], [number, number], [number, number], [number, number]];
const corners = (w: number, e: number): Corners => [[w, 85], [e, 85], [e, -85], [w, -85]];

/**
 * Adds/updates a global raster overlay from a canvas. A single image spanning 360 degrees does not
 * render on the globe, so the canvas is split into four 90-degree tiles (ids `${id}-0..3`).
 */
function putImage(map: maplibregl.Map, id: string, canvas: HTMLCanvasElement, beforeId: string | undefined, opacity: number): void {
  const parts = 4;
  const pw = canvas.width / parts;
  for (let k = 0; k < parts; k++) {
    const part = document.createElement('canvas');
    part.width = pw; part.height = canvas.height;
    part.getContext('2d')!.drawImage(canvas, k * pw, 0, pw, canvas.height, 0, 0, pw, canvas.height);
    const url = part.toDataURL('image/png');
    const sid = `${id}-${k}`;
    const c = corners(-180 + k * 90, -90 + k * 90);
    const src = map.getSource(sid) as any;
    if (src) src.updateImage({ url, coordinates: c });
    else {
      map.addSource(sid, { type: 'image', url, coordinates: c });
      map.addLayer({ id: sid, type: 'raster', source: sid, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, beforeId);
    }
  }
}

export function setLayerVisible(map: maplibregl.Map, id: string, v: boolean): void {
  const ids = map.getLayer(id) ? [id] : [0, 1, 2, 3].map((k) => `${id}-${k}`).filter((x) => map.getLayer(x));
  for (const x of ids) map.setLayoutProperty(x, 'visibility', v ? 'visible' : 'none');
}

/** Sub-solar point for a given date (approximate, good to a fraction of a degree). */
export function subsolar(date: Date): { lon: number; lat: number } {
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const g = ((357.529 + 0.98560028 * d) * Math.PI) / 180;
  const q = 280.459 + 0.98564736 * d;
  const L = ((q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI) / 180;
  const e = ((23.439 - 0.00000036 * d) * Math.PI) / 180;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  let lon = ((ra * 180) / Math.PI - gmst * 15) % 360;
  if (lon < -180) lon += 360; if (lon > 180) lon -= 360;
  return { lon, lat: (dec * 180) / Math.PI };
}

export function drawNight(map: maplibregl.Map, date: Date, beforeId?: string): void {
  const W = 360, H = 180;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const s = subsolar(date);
  const D = Math.PI / 180;
  for (let j = 0; j < H; j++) {
    const lat = mercatorRowLat(j, H);
    for (let i = 0; i < W; i++) {
      const lon = -180 + (i + 0.5) * (360 / W);
      const cosz = Math.sin(lat * D) * Math.sin(s.lat * D) + Math.cos(lat * D) * Math.cos(s.lat * D) * Math.cos((lon - s.lon) * D);
      const alt = Math.asin(cosz) / D; // solar altitude
      const dark = Math.min(1, Math.max(0, (2 - alt) / 10));
      const k = (j * W + i) * 4;
      img.data[k] = 2; img.data[k + 1] = 6; img.data[k + 2] = 24; img.data[k + 3] = Math.round(dark * 175);
    }
  }
  ctx.putImageData(img, 0, 0);
  putImage(map, 'night', cv, beforeId, 1);
}

export function drawHeat(map: maplibregl.Map, grid: TempGrid, mode: TempMode, threshold: number | null, beforeId?: string): void {
  const W = 720, H = 360;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    const lat = mercatorRowLat(j, H);
    for (let i = 0; i < W; i++) {
      const lon = -180 + (i + 0.5) * (360 / W);
      const t = sample(grid, mode, lon, lat);
      const k = (j * W + i) * 4;
      if (t == null) continue;
      const scaled = mode === 'range' ? rangeToScale(t) : t;
      const [r, g, b] = tempColor(scaled);
      let a = 165;
      if (threshold != null) {
        // Highlight the band around the chosen value, dim everything else.
        const near = Math.abs(scaled - threshold);
        a = near <= 2.5 ? 235 : 60;
      }
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  putImage(map, 'heat', cv, beforeId, 0.85);
}
