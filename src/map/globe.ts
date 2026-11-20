import maplibregl, { type StyleSpecification } from 'maplibre-gl';

// Free, no-key sources (see README for licenses).
export const SAT_TILES = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const SAT_ATTR = '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX (Copernicus Sentinel data 2016, CC BY 4.0)';
const DEM_ATTR = 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a> (SRTM, GMTED, ETOPO1 등)';
const DATA_ATTR = '국경: <a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noopener">historical-basemaps</a> (GPL-3.0), Natural Earth · 한국사 영역: 자체 작성(대략적)';

export function buildStyle(): StyleSpecification {
  return {
    version: 8,
    projection: { type: 'globe' },
    sources: {
      sat: { type: 'raster', tiles: [SAT_TILES], tileSize: 256, maxzoom: 14, attribution: SAT_ATTR },
      dem: { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, maxzoom: 12, encoding: 'terrarium', attribution: DEM_ATTR },
      demShade: { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, maxzoom: 12, encoding: 'terrarium' },
      hist: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: DATA_ATTR },
      korea: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      modern: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      rivers: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      jet: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      battleUnits: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      battlePaths: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'space', type: 'background', paint: { 'background-color': '#02040a' } },
      { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.05, 'raster-contrast': 0.05 } },
      { id: 'shade', type: 'hillshade', source: 'demShade', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#1b2233', 'hillshade-highlight-color': '#fff7e0' } },
      { id: 'hist-fill', type: 'fill', source: 'hist', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.32, 8, 0.1, 10, 0.04] } },
      { id: 'hist-line', type: 'line', source: 'hist', paint: { 'line-color': '#ffffff', 'line-opacity': 0.45, 'line-width': 0.8 } },
      { id: 'korea-fill', type: 'fill', source: 'korea', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 8.5, 0.14, 10, 0.06] } },
      { id: 'korea-line', type: 'line', source: 'korea', paint: { 'line-color': '#ffffff', 'line-opacity': 0.9, 'line-width': 1.6 } },
      { id: 'rivers', type: 'line', source: 'rivers', layout: { visibility: 'none' }, paint: { 'line-color': '#5fe3ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 6, 3], 'line-opacity': 0.9, 'line-blur': 0.6 } },
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
    center: [120, 30],
    zoom: 1.6,
    pitch: 0,
    maxPitch: 75,
    attributionControl: { compact: true },
    canvasContextAttributes: { antialias: true, preserveDrawingBuffer: false },
  } as any);
  map.touchZoomRotate.enable();
  return map;
}
