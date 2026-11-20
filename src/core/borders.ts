import { snapshotFor } from './time';

export type FC = { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; geometry: unknown; properties: Record<string, any> }> };
type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

/** Loads and caches historical border snapshots and the Korean overlay. */
export class BorderData {
  years: number[] = [];
  korea: FC | null = null;
  private cache = new Map<number, Promise<FC>>();
  constructor(private base = '/data', private fetcher: Fetcher = (u) => fetch(u)) {}

  private async getJson(url: string): Promise<any> {
    const r = await this.fetcher(url);
    if (!r.ok) throw new Error(`load failed ${r.status}: ${url}`);
    return r.json();
  }
  async init(): Promise<void> {
    const [idx, korea] = await Promise.all([this.getJson(`${this.base}/borders/index.json`), this.getJson(`${this.base}/korea.json`)]);
    this.years = idx.years;
    this.korea = korea;
  }
  snapshot(year: number): number { return snapshotFor(year, this.years); }
  load(snapshot: number): Promise<FC> {
    let p = this.cache.get(snapshot);
    if (!p) {
      p = this.getJson(`${this.base}/borders/${snapshot}.json`);
      p.catch(() => this.cache.delete(snapshot));
      this.cache.set(snapshot, p);
    }
    return p;
  }
  /** Korean overlay features valid in `year`. */
  koreaAt(year: number): FC['features'] {
    return (this.korea?.features ?? []).filter((f) => f.properties.from <= year && f.properties.to >= year);
  }
}
