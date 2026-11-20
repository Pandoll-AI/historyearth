import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mercatorRowLat, rangeToScale, sample, tempColor, type TempGrid } from '../src/climate/temperature';
import { monsoonJanuary, monsoonJuly, siberianHigh, springWesterlies, inBox } from '../src/climate/winds';
import { subsolar } from '../src/map/overlays';
import { along, battleFrame, stageAt, BATTLES } from '../src/map/battles';

const grid: TempGrid = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/data/temperature.json'), 'utf8'));

describe('temperature grid', () => {
  it('has complete data', () => {
    expect(grid.jan.length).toBe(grid.lons.length * grid.lats.length);
    expect(grid.jan.filter((v) => v == null).length).toBe(0);
    expect(grid.jul.filter((v) => v == null).length).toBe(0);
  });
  it('is physically plausible', () => {
    const siberiaJan = sample(grid, 'jan', 110, 60)!;
    const siberiaJul = sample(grid, 'jul', 110, 60)!;
    const seoulJan = sample(grid, 'jan', 127, 37.5)!;
    const equator = sample(grid, 'jan', 20, 0)!;
    expect(siberiaJan).toBeLessThan(-15);
    expect(siberiaJul).toBeGreaterThan(5);
    expect(seoulJan).toBeLessThan(5);
    expect(equator).toBeGreaterThan(18);
    expect(sample(grid, 'range', 110, 60)!).toBeGreaterThan(sample(grid, 'range', -150, 0)!);
  });
  it('wraps across the antimeridian', () => {
    expect(sample(grid, 'jan', 179.9, 0)).not.toBeNull();
    expect(sample(grid, 'jan', -179.9, 0)).not.toBeNull();
  });
  it('colour scale goes from purple-blue (cold) to red (hot)', () => {
    const cold = tempColor(-30), hot = tempColor(30);
    expect(cold[2]).toBeGreaterThan(cold[0]);
    expect(hot[0]).toBeGreaterThan(hot[2]);
    expect(tempColor(-99)).toEqual(cold);
    expect(rangeToScale(0)).toBe(-30);
  });
  it('mercator rows are symmetric and monotonic', () => {
    expect(mercatorRowLat(0, 100)).toBeGreaterThan(80);
    expect(mercatorRowLat(99, 100)).toBeLessThan(-80);
    expect(Math.abs(mercatorRowLat(49.5, 100))).toBeLessThan(1e-9);
  });
});

describe('wind fields', () => {
  it('summer monsoon blows from the sea toward land, winter the opposite', () => {
    const [u, v] = monsoonJuly(70, 15);
    expect(u).toBeGreaterThan(0); expect(v).toBeGreaterThan(0); // SW wind over Arabian Sea
    const [u2, v2] = monsoonJanuary(80, 20);
    expect(u2).toBeLessThan(0); expect(v2).toBeLessThan(0); // NE wind over India
    expect(monsoonJuly(125, 25)[1]).toBeGreaterThan(0); // southerly toward Korea
    expect(monsoonJanuary(125, 40)[1]).toBeLessThan(0); // northwesterly in Korea
  });
  it('westerlies carry dust east', () => {
    expect(springWesterlies(105, 43)[0]).toBeGreaterThan(0.9);
  });
  it('Siberian high blows southeast over Korea', () => {
    const [u, v] = siberianHigh(127, 40);
    expect(u).toBeGreaterThan(0); expect(v).toBeLessThan(0);
  });
  it('inBox works', () => {
    expect(inBox(1, 1, [0, 0, 2, 2])).toBe(true);
    expect(inBox(3, 1, [0, 0, 2, 2])).toBe(false);
  });
});

describe('sun and battles', () => {
  it('subsolar point is near the tropics', () => {
    const june = subsolar(new Date(Date.UTC(2026, 5, 21, 12)));
    const dec = subsolar(new Date(Date.UTC(2026, 11, 21, 12)));
    expect(june.lat).toBeGreaterThan(23); expect(june.lat).toBeLessThan(23.6);
    expect(dec.lat).toBeLessThan(-23);
    expect(Math.abs(june.lon)).toBeLessThan(3); // noon UTC -> near Greenwich
  });
  it('interpolates paths and stages', () => {
    expect(along([[0, 0], [2, 0]], 0.5)).toEqual([1, 0]);
    expect(along([[0, 0], [1, 0], [1, 1]], 1)).toEqual([1, 1]);
    const b = BATTLES.find((x) => x.id === 'hansando')!;
    expect(stageAt(b, 0).text).toMatch(/견내량/);
    expect(stageAt(b, 0.5).text).toMatch(/학익진/);
    const end = battleFrame(b, 1);
    const sunk = end.units.features.filter((f: any) => f.properties.color === '#555').length;
    expect(sunk).toBe(12);
  });
});

describe('dust path', () => {
  it('dust from the Gobi reaches Korea at Korean latitudes', () => {
    let lon = 106, lat = 44;
    while (lon < 127) { const [u, v] = springWesterlies(lon, lat); lon += u * 0.1; lat += v * 0.1; }
    expect(lat).toBeGreaterThan(34.5); expect(lat).toBeLessThan(39.5);
  });
});
