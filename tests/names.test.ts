import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GEO_LABELS, PLACES } from '../src/core/content';
// @ts-expect-error plain ESM build script without types
import { nameKo } from '../scripts/name-ko.mjs';

const DATA = path.resolve(__dirname, '../public/data');
const LATIN = /[A-Za-z]/;
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const shown = (fc: any, keys: string[]) => fc.features.flatMap((f: any) => keys.map((k) => f.properties?.[k]).filter((v: unknown) => typeof v === 'string'));

describe('displayed names are Korean only', () => {
  it('every polity name in every border snapshot has no Latin letters', () => {
    const files = fs.readdirSync(path.join(DATA, 'borders')).filter((f) => f !== 'index.json');
    expect(files.length).toBeGreaterThanOrEqual(46);
    const bad: string[] = [];
    for (const f of files) for (const t of shown(read(`borders/${f}`), ['k', 's'])) if (LATIN.test(t)) bad.push(`${f}: ${t}`);
    expect(bad).toEqual([]);
  });
  it('Korean overlay, modern labels, rivers and app labels have no Latin letters', () => {
    const texts = [
      ...shown(read('korea.json'), ['k']),
      ...shown(read('modern-labels.json'), ['k', 'name', 'n']),
      ...shown(read('rivers.json'), ['n']),
      ...GEO_LABELS.map((g) => g.text),
      ...PLACES.map((p: any) => p.name ?? p.label ?? ''),
    ];
    expect(texts.length).toBeGreaterThan(100);
    expect(texts.filter((t) => LATIN.test(t))).toEqual([]);
  });
  it('the mapping table and fallback produce Korean for sample names', () => {
    const table = fs.readFileSync(path.resolve(__dirname, '../scripts/name-ko-table.txt'), 'utf8').split('\n').filter((l) => l.includes('|') && !l.startsWith('#'));
    expect(table.length).toBeGreaterThan(800);
    for (const l of table) expect(LATIN.test(l.split('|')[1])).toBe(false);
    for (const n of ['Ming Chinese Empire', 'Northern Yuan', 'Holy Roman Empire', 'Ottoman Empire', 'Kamilaroi', 'Hallstatt culture', 'Bermuda (UK)'])
      expect(LATIN.test(nameKo(n))).toBe(false);
    expect(nameKo('Ming Chinese Empire')).toBe('명');
    expect(nameKo('Northern Yuan')).toBe('북원');
  });
});

describe('1368-1500 East Asia', () => {
  it('1400 and 1368 show Ming, Northern Yuan and Jurchen as separate polities', () => {
    for (const y of [1368, 1400]) {
      const names = shown(read(`borders/${y}.json`), ['k']);
      expect(names).toContain('명');
      expect(names).toContain('북원');
      expect(names).toContain('여진');
      expect(names.some((n: string) => n.includes('대칸국') || n === '명·북원')).toBe(false);
    }
    expect(read('borders/index.json').years).toContain(1368);
  });
});
