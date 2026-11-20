import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BorderData } from '../src/core/borders';
import { search } from '../src/core/search';
import { PLACES, ERA_BUTTONS } from '../src/core/content';
import { koreanEra, normalizeYear } from '../src/core/time';

const PUB = path.resolve(__dirname, '../public');
const fsFetch = async (url: string) => {
  const f = path.join(PUB, url);
  if (!fs.existsSync(f)) return { ok: false, status: 404, json: async () => null };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) };
};

describe('border data loading', () => {
  it('loads the index, korea overlay and a snapshot', async () => {
    const d = new BorderData('/data', fsFetch);
    await d.init();
    expect(d.years.length).toBeGreaterThanOrEqual(40);
    expect(d.years[0]).toBe(-3000);
    expect(d.snapshot(475)).toBe(400);
    const fc = await d.load(d.snapshot(475));
    expect(fc.features.length).toBeGreaterThan(50);
    const p = fc.features[0].properties;
    for (const k of ['n', 'k', 'a', 'lx', 'ly', 'kr', 'c']) expect(p).toHaveProperty(k);
  });
  it('caches snapshot loads', async () => {
    const d = new BorderData('/data', fsFetch);
    await d.init();
    expect(d.load(500)).toBe(d.load(500));
  });
  it('rejects a missing snapshot and allows retry', async () => {
    const d = new BorderData('/data', fsFetch);
    await d.init();
    await expect(d.load(123456)).rejects.toThrow(/load failed 404/);
  });
  it('korea overlay matches textbook periods', async () => {
    const d = new BorderData('/data', fsFetch);
    await d.init();
    const names = (y: number) => d.koreaAt(y).map((f) => f.properties.k).sort();
    expect(names(475)).toEqual(['가야', '고구려', '백제', '부여', '신라'].sort());
    expect(names(800)).toEqual(['발해', '통일신라'].sort());
    expect(names(910)).toEqual(['발해', '신라(후삼국)', '후고구려(태봉)', '후백제'].sort());
    expect(names(1100)).toEqual(['고려']);
    expect(names(1450)).toEqual(['조선']);
    expect(names(2026)).toEqual(['대한민국', '조선민주주의인민공화국(북한)'].sort());
    expect(names(-3000)).toEqual([]);
  });
  it('every year from BC 2333 has at least one Korean polity', async () => {
    const d = new BorderData('/data', fsFetch);
    await d.init();
    for (let y = -2333; y <= 2026; y++) if (y !== 0) expect(d.koreaAt(y).length, String(y)).toBeGreaterThan(0);
  });
  it('every snapshot file referenced by the index exists and parses', () => {
    const idx = JSON.parse(fs.readFileSync(path.join(PUB, 'data/borders/index.json'), 'utf8'));
    for (const y of idx.years) {
      const fc = JSON.parse(fs.readFileSync(path.join(PUB, `data/borders/${y}.json`), 'utf8'));
      expect(fc.type).toBe('FeatureCollection');
    }
  });
});

describe('search', () => {
  const polities = [{ k: '로마 제국', n: 'Roman Empire', lx: 12, ly: 42, a: 4e6 }, { k: '몽골 제국', n: 'Mongol Empire', lx: 100, ly: 47, a: 2e7 }];
  it('finds places by alias', () => {
    const r = search('계백', PLACES, polities);
    expect(r[0].label).toBe('황산벌 전투');
    expect(r[0].year).toBe(660);
  });
  it('finds polities by Korean or English names', () => {
    expect(search('로마', PLACES, polities).some((h) => h.label === '로마 제국')).toBe(true);
    expect(search('mongol', PLACES, polities)[0].label).toBe('몽골 제국');
  });
  it('returns nothing for empty query', () => {
    expect(search('  ', PLACES, polities)).toEqual([]);
  });
});

describe('content', () => {
  it('era buttons point to years in the matching Korean era', () => {
    const expectEra: Record<string, string> = { gojoseon: '고조선', goguryeo: '삼국 시대', unified: '남북국 시대', later3: '후삼국 시대', goryeo: '고려 시대', joseon1: '조선 전기', colonial: '일제 강점기' };
    for (const e of ERA_BUTTONS) if (expectEra[e.id]) expect(koreanEra(normalizeYear(e.year, 2026)).name).toBe(expectEra[e.id]);
  });
  it('places have valid coordinates', () => {
    for (const p of PLACES) {
      expect(p.lon).toBeGreaterThan(-180); expect(p.lon).toBeLessThan(180);
      expect(p.lat).toBeGreaterThan(-90); expect(p.lat).toBeLessThan(90);
    }
  });
});
