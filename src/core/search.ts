import type { Place } from './content';

export interface SearchHit { kind: string; label: string; sub: string; lon: number; lat: number; zoom: number; year?: number; placeId?: string }
export interface PolityLabel { k: string; n: string; lx: number; ly: number; a: number }

const norm = (s: string): string => s.toLowerCase().replace(/[\s·.,()]/g, '');

export function search(q: string, places: Place[], polities: PolityLabel[], limit = 8): SearchHit[] {
  const nq = norm(q);
  if (!nq) return [];
  const hits: Array<SearchHit & { score: number }> = [];
  for (const p of places) {
    const keys = [p.name, ...p.aliases].map(norm);
    const score = keys.some((k) => k === nq) ? 3 : keys.some((k) => k.startsWith(nq)) ? 2 : keys.some((k) => k.includes(nq)) ? 1 : 0;
    if (score) hits.push({ kind: p.kind, label: p.name, sub: p.desc, lon: p.lon, lat: p.lat, zoom: p.zoom, year: p.year, placeId: p.id, score: score + 0.5 });
  }
  const seen = new Set<string>();
  for (const f of [...polities].sort((a, b) => b.a - a.a)) {
    const keys = [norm(f.k), norm(f.n)];
    if (seen.has(f.k)) continue;
    const score = keys.some((k) => k === nq) ? 3 : keys.some((k) => k.startsWith(nq)) ? 2 : keys.some((k) => k.includes(nq)) ? 1 : 0;
    if (score) {
      seen.add(f.k);
      const zoom = f.a > 3e6 ? 2.5 : f.a > 5e5 ? 3.5 : 5;
      hits.push({ kind: '나라·집단', label: f.k, sub: f.n !== f.k ? f.n : '', lon: f.lx, lat: f.ly, zoom, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit).map(({ score: _s, ...h }) => h);
}
