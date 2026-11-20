import maplibregl, { type StyleSpecification } from 'maplibre-gl';

// Free, no-key sources (see README for licenses).
export const SAT_TILES = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';
// NASA Blue Marble shaded relief + bathymetry (public domain) via NASA GIBS, no key.
export const BM_TILES = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const SAT_ATTR = '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX (Copernicus Sentinel data 2016, CC BY 4.0)';
const BM_ATTR = 'Blue Marble: <a href="https://earthobservatory.nasa.gov/features/BlueMarble" target="_blank" rel="noopener">NASA Earth Observatory</a> via GIBS (public domain)';
const DEM_ATTR = 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a> (SRTM, GMTED, ETOPO1 등)';
const DATA_ATTR = '국경: <a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noopener">historical-basemaps</a> (GPL-3.0), Natural Earth · 한국사 영역: 자체 작성';

/** Border layers that crossfade on a year change, with their full (unfaded) opacity. */
export const FADE_LAYERS: Record<string, { prop: string; stops: number[] | number }> = {
  'hist-fill': { prop: 'fill-opacity', stops: [4, 0.6, 7, 0.4, 9, 0.18, 11, 0.06] },
  'korea-fill': { prop: 'fill-opacity', stops: [4, 0.66, 7, 0.45, 9, 0.2, 11, 0.08] },
  'hist-casing': { prop: 'line-opacity', stops: 0.55 },
  'hist-line': { prop: 'line-opacity', stops: 0.9 },
  'korea-casing': { prop: 'line-opacity', stops: 0.65 },
  'korea-line': { prop: 'line-opacity', stops: 0.95 },
};
/** Opacity value for a fade layer scaled by f in [0, 1]. */
export function fadeOpacity(id: string, f: number): any {
  const { stops } = FADE_LAYERS[id];
  if (typeof stops === 'number') return stops * f;
  const out: any[] = ['interpolate', ['linear'], ['zoom']];
  for (let i = 0; i < stops.length; i += 2) out.push(stops[i], stops[i + 1] * f);
  return out;
}

export function buildStyle(): StyleSpecification {
  const style = buildBaseStyle();
  // Each fade layer gets a "-prev" twin (just below it) fed by the previous year's data.
  for (const id of Object.keys(FADE_LAYERS)) {
    const i = style.layers.findIndex((l) => l.id === id);
    const l = style.layers[i] as any;
    style.layers.splice(i, 0, { ...l, id: `${id}-prev`, source: `${l.source}Prev`, paint: { ...l.paint, [FADE_LAYERS[id].prop]: fadeOpacity(id, 0) } });
  }
  return style;
}

function buildBaseStyle(): StyleSpecification {
  return {
    version: 8,
    projection: { type: 'globe' },
    sources: {
      bm: { type: 'raster', tiles: [BM_TILES], tileSize: 256, maxzoom: 8, attribution: BM_ATTR },
      sat: { type: 'raster', tiles: [SAT_TILES], tileSize: 256, minzoom: 6, maxzoom: 14, attribution: SAT_ATTR },
      dem: { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, maxzoom: 12, encoding: 'terrarium', attribution: DEM_ATTR },
      demShade: { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, maxzoom: 12, encoding: 'terrarium' },
      hist: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: DATA_ATTR },
      korea: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      histPrev: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      koreaPrev: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      modern: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      rivers: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      jet: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      battleUnits: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      battlePaths: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'space', type: 'background', paint: { 'background-color': '#02040a' } },
      { id: 'bm', type: 'raster', source: 'bm', paint: { 'raster-saturation': 0.1, 'raster-contrast': 0.08, 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 8.5, 0] } },
      { id: 'sat', type: 'raster', source: 'sat', minzoom: 6.5, paint: { 'raster-saturation': -0.05, 'raster-contrast': 0.05, 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0, 7.8, 1] } },
      // Atlas fills: saturated, fading out when zoomed in close (battle views).
      { id: 'hist-fill', type: 'fill', source: 'hist', paint: { 'fill-color': ['get', 'c'], 'fill-antialias': false, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 7, 0.4, 9, 0.18, 11, 0.06] } },
      { id: 'korea-fill', type: 'fill', source: 'korea', paint: { 'fill-color': ['get', 'c'], 'fill-antialias': false, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.66, 7, 0.45, 9, 0.2, 11, 0.08] } },
      // Relief drawn above the fills so mountains stay visible through the colours.
      { id: 'shade', type: 'hillshade', source: 'demShade', paint: { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': 'rgba(10,14,30,0.55)', 'hillshade-highlight-color': 'rgba(255,250,235,0.35)', 'hillshade-accent-color': 'rgba(0,0,0,0.15)' } },
      { id: 'rivers', type: 'line', source: 'rivers', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#4aa3ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, ['match', ['get', 'r'], [0, 1, 2, 3, 4], 1.1, 0.5], 6, ['match', ['get', 'r'], [0, 1, 2, 3, 4], 2.4, 1.4], 9, 3], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.75, 6, 0.95] } },
      { id: 'hist-casing', type: 'line', source: 'hist', layout: { 'line-join': 'round' }, paint: { 'line-color': '#141824', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.6, 6, 3] } },
      { id: 'hist-line', type: 'line', source: 'hist', layout: { 'line-join': 'round' }, paint: { 'line-color': '#f4f1e8', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 6, 1.1] } },
      { id: 'korea-casing', type: 'line', source: 'korea', layout: { 'line-join': 'round' }, paint: { 'line-color': '#141824', 'line-opacity': 0.65, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2, 6, 3.6] } },
      { id: 'korea-line', type: 'line', source: 'korea', layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.95, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.8, 6, 1.5] } },
      { id: 'modern-line', type: 'line', source: 'modern', layout: { visibility: 'none' }, paint: { 'line-color': '#ffe08a', 'line-width': 1.1, 'line-dasharray': [3, 2], 'line-opacity': 0.9 } },
      { id: 'jet', type: 'line', source: 'jet', layout: { visibility: 'none' }, paint: { 'line-color': '#ffd36b', 'line-width': 3, 'line-opacity': 0.55, 'line-dasharray': [4, 3] } },
      { id: 'battle-paths', type: 'line', source: 'battlePaths', paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 } },
      { id: 'battle-units', type: 'circle', source: 'battleUnits', paint: {
        'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 7],
        'circle-stroke-color': '#fff', 'circle-stroke-width': 1.2, 'circle-opacity': ['coalesce', ['get', 'op'], 1], 'circle-stroke-opacity': ['coalesce', ['get', 'op'], 1] } },
    ],
    sky: {
      'sky-color': '#0d2347', 'horizon-color': '#6fa6e8', 'fog-color': '#a9c8ef',
      'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.8,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
    },
    terrain: { source: 'dem', exaggeration: 2 },
  } as StyleSpecification;
}

export function createMap(container: HTMLElement): maplibregl.Map {
  const map = new maplibregl.Map({
    container,
    style: buildStyle(),
    center: [118, 34],
    zoom: 1.8,
    pitch: 0,
    maxPitch: 75,
    attributionControl: { compact: true },
    canvasContextAttributes: { antialias: true, preserveDrawingBuffer: false },
  } as any);
  map.touchZoomRotate.enable();
  return map;
}
