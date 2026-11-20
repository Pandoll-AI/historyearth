import type maplibregl from 'maplibre-gl';

export interface LabelItem { id: string; lon: number; lat: number; text: string; cls?: string; pri: number; sub?: string }

const DEG = Math.PI / 180;
function angularDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const a = Math.sin(((lat2 - lat1) * DEG) / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(((lon2 - lon1) * DEG) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(a)))) / DEG;
}

/**
 * DOM labels with outline text, a dot and a short leader line. Greedy collision
 * by priority, hidden on the far side of the globe. Redrawn on every map render.
 */
export class LabelLayer {
  private items: LabelItem[] = [];
  private els = new Map<string, { el: HTMLDivElement; w: number; h: number }>();
  private root: HTMLDivElement;
  private raf = 0;
  constructor(private map: maplibregl.Map, parent: HTMLElement, className = 'labels') {
    this.root = document.createElement('div');
    this.root.className = className;
    parent.appendChild(this.root);
    map.on('render', () => this.schedule());
  }
  setItems(items: LabelItem[]): void {
    this.items = [...items].sort((a, b) => b.pri - a.pri);
    const keep = new Set(items.map((i) => i.id));
    for (const [id, e] of this.els) if (!keep.has(id)) { e.el.remove(); this.els.delete(id); }
    for (const it of this.items) {
      let e = this.els.get(it.id);
      const html = `<span class="dot"></span><span class="leader"></span><span class="txt">${escapeHtml(it.text)}${it.sub ? `<small>${escapeHtml(it.sub)}</small>` : ''}</span>`;
      if (!e) {
        const el = document.createElement('div');
        el.className = `lbl ${it.cls ?? ''}`;
        el.innerHTML = html;
        this.root.appendChild(el);
        e = { el, w: 0, h: 0 };
        this.els.set(it.id, e);
      } else if (e.el.dataset.t !== it.text + (it.sub ?? '')) {
        e.el.innerHTML = html;
        e.el.className = `lbl ${it.cls ?? ''}`;
        e.w = 0;
      }
      e.el.dataset.t = it.text + (it.sub ?? '');
    }
    this.schedule();
  }
  setVisible(v: boolean): void { this.root.style.display = v ? '' : 'none'; }
  private schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.layout(); });
  }
  visibleCount(): number { let n = 0; for (const e of this.els.values()) if (e.el.style.display !== 'none') n++; return n; }
  private layout(): void {
    if (this.root.style.display === 'none') return;
    const c = this.map.getCenter();
    const W = this.map.getContainer().clientWidth, H = this.map.getContainer().clientHeight;
    const placed: Array<[number, number, number, number]> = [];
    const zoom = this.map.getZoom();
    const maxAng = Math.min(zoom < 3 ? 72 : 80, (3 * 360 * Math.max(W, H)) / (512 * 2 ** zoom));
    for (const it of this.items) {
      const e = this.els.get(it.id)!;
      if (angularDistance(c.lng, c.lat, it.lon, it.lat) > maxAng) { e.el.style.display = 'none'; continue; }
      const p = this.map.project([it.lon, it.lat]);
      if (p.x < -50 || p.y < -50 || p.x > W + 50 || p.y > H + 50) { e.el.style.display = 'none'; continue; }
      // Occlusion test: a point behind the globe (or beyond the horizon) does not round-trip.
      if (p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H) {
        const back = this.map.unproject(p);
        const tol = Math.max(0.05, (40 * 360) / (512 * 2 ** zoom));
        if (angularDistance(back.lng, back.lat, it.lon, it.lat) > tol) { e.el.style.display = 'none'; continue; }
      }
      if (!e.w) { e.el.style.display = ''; e.w = e.el.offsetWidth || it.text.length * 12; e.h = e.el.offsetHeight || 20; }
      const box: [number, number, number, number] = [p.x - e.w / 2, p.y - e.h, p.x + e.w / 2, p.y];
      const hit = placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
      if (hit) { e.el.style.display = 'none'; continue; }
      placed.push(box);
      e.el.style.display = '';
      e.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    }
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
