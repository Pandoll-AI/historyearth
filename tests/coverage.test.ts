import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { booleanPointInPolygon } from '@turf/turf';

// Land points on the eastern China coast must lie inside some polity (world snapshot
// or the own Korean overlay) in the classroom years.
const DATA = path.resolve(__dirname, '../public/data');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const POINTS: Record<string, [number, number]> = {
  상하이: [121.47, 31.23], 항저우: [120.16, 30.27], 칭다오: [120.38, 36.07], 푸저우: [119.3, 26.08], 난징: [118.8, 32.06], 닝보: [121.55, 29.87],
  원저우: [120.67, 28.0], 취안저우: [118.6, 24.9], 롄윈강: [119.22, 34.6], 톈진: [117.2, 39.13], 다롄: [121.6, 38.91], 광저우: [113.26, 23.13],
};

describe('eastern China coverage', () => {
  const years: number[] = read('borders/index.json').years;
  const korea = read('korea.json').features;
  for (const year of [475, 700, 1450, 2026]) {
    it(`every sample city is inside a polity in ${year}`, () => {
      const snap = [...years].reverse().find((s) => s <= year)!;
      const feats = [...read(`borders/${snap}.json`).features, ...korea.filter((f: any) => f.properties.from <= year && f.properties.to >= year)];
      const missing = Object.entries(POINTS).filter(([, p]) => !feats.some((f: any) => booleanPointInPolygon(p, f))).map(([n]) => n);
      expect(missing).toEqual([]);
    });
  }
});
