import { describe, expect, it } from 'vitest';
import { formatYear, koreanEra, normalizeYear, sliderToYear, snapshotFor, yearToSlider, MIN_YEAR } from '../src/core/time';

describe('year handling', () => {
  it('formats BC and AD years in Korean', () => {
    expect(formatYear(-3000)).toBe('기원전 3000년');
    expect(formatYear(-1)).toBe('기원전 1년');
    expect(formatYear(1)).toBe('1년');
    expect(formatYear(475)).toBe('475년');
  });
  it('has no year zero and clamps to range', () => {
    expect(normalizeYear(0, 2026)).toBe(1);
    expect(normalizeYear(-5000, 2026)).toBe(MIN_YEAR);
    expect(normalizeYear(9999, 2026)).toBe(2026);
    expect(normalizeYear(474.6, 2026)).toBe(475);
  });
  it('slider mapping is continuous and round-trips across BC/AD', () => {
    expect(yearToSlider(-1)).toBe(0);
    expect(yearToSlider(1)).toBe(1);
    for (const y of [-3000, -1000, -2, -1, 1, 2, 660, 2026]) expect(sliderToYear(yearToSlider(y))).toBe(y);
  });
  it('maps years to Korean eras', () => {
    expect(koreanEra(-3000).name).toBe('선사 시대');
    expect(koreanEra(-2333).name).toBe('고조선');
    expect(koreanEra(475).name).toBe('삼국 시대');
    expect(koreanEra(800).name).toBe('남북국 시대');
    expect(koreanEra(910).name).toBe('후삼국 시대');
    expect(koreanEra(1300).name).toBe('고려(원 간섭기)');
    expect(koreanEra(1592).name).toBe('조선 후기');
    expect(koreanEra(1930).name).toBe('일제 강점기');
    expect(koreanEra(2026).name).toBe('대한민국');
  });
  it('every year in range has a named era', () => {
    for (let y = MIN_YEAR; y <= 2026; y++) if (y !== 0) expect(koreanEra(y).name).not.toBe('알 수 없음');
  });
  it('picks the latest snapshot not after the year', () => {
    const ys = [-3000, -1000, 1, 400, 500, 2010];
    expect(snapshotFor(-3000, ys)).toBe(-3000);
    expect(snapshotFor(-2999, ys)).toBe(-3000);
    expect(snapshotFor(475, ys)).toBe(400);
    expect(snapshotFor(500, ys)).toBe(500);
    expect(snapshotFor(2026, ys)).toBe(2010);
    expect(snapshotFor(-9999, ys)).toBe(-3000);
  });
});
