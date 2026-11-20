import type maplibregl from 'maplibre-gl';
import { inBox, type Box, type Vec } from '../climate/winds';

export interface ParticleConfig {
  field: (lon: number, lat: number) => Vec;
  sources: Box[];
  count: number;
  speed: number; // degrees per second at |v| = 1
  life: [number, number]; // seconds
  color: string;
  style: 'trail' | 'dust';
  bounds: Box; // particles leaving this box respawn
  rainZones?: Box[];
}

interface P { lon: number; lat: number; age: number; life: number; trail: number[]; cloud: number; size: number }

const TRAIL = 6;
const DEG = Math.PI / 180;

/** Canvas overlay that advects particles through a wind field and draws them on the globe. */
export class ParticleLayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ps: P[] = [];
  private cfg: ParticleConfig | null = null;
  private running = false;
  private last = 0;
  private raf = 0;
  frames = 0;
  constructor(private map: maplibregl.Map, parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'particles';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(parent);
    this.resize();
  }
  private resize(): void {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const el = this.canvas.parentElement!;
    this.canvas.width = Math.round(el.clientWidth * dpr);
    this.canvas.height = Math.round(el.clientHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  set(cfg: ParticleConfig | null): void {
    this.cfg = cfg;
    this.ps = [];
    if (cfg) {
      const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
      const n = Math.round(cfg.count * (mobile ? 0.5 : 1));
      for (let i = 0; i < n; i++) { const p = this.spawn(); this.prewarm(p, Math.random() * p.life * 0.9); this.ps.push(p); }
    }
    this.draw(0);
    if (cfg && !this.raf) this.loop();
  }
  setRunning(r: boolean): void { this.running = r; if (r && this.cfg && !this.raf) this.loop(); }
  private spawn(): P {
    const cfg = this.cfg!;
    const b = cfg.sources[Math.floor(Math.random() * cfg.sources.length)];
    const lon = b[0] + Math.random() * (b[2] - b[0]);
    const lat = b[1] + Math.random() * (b[3] - b[1]);
    const life = cfg.life[0] + Math.random() * (cfg.life[1] - cfg.life[0]);
    return { lon, lat, age: 0, life, trail: [lon, lat], cloud: 0, size: 1.5 + Math.random() * 2 };
  }
  /** Advance a fresh particle along the field so the flow is spread out from the first frame. */
  private prewarm(p: P, seconds: number): void {
    const cfg = this.cfg!;
    const dt = 0.1;
    for (let t = 0; t < seconds; t += dt) {
      const [u, v] = cfg.field(p.lon, p.lat);
      p.lon += (u * cfg.speed * dt) / Math.max(0.3, Math.cos(p.lat * DEG));
      p.lat += (v + (cfg.style === 'dust' ? (Math.random() - 0.5) * 1.2 : 0)) * cfg.speed * dt;
      if (!inBox(p.lon, p.lat, cfg.bounds)) break;
    }
    p.age = seconds;
    p.trail = [p.lon, p.lat];
  }
  private loop = (): void => {
    this.raf = requestAnimationFrame((t) => {
      this.raf = 0;
      const dt = this.last ? Math.min(0.12, (t - this.last) / 1000) : 0.016;
      this.last = t;
      if (!this.cfg) { this.clear(); return; }
      this.draw(this.running ? dt : 0);
      this.loop();
    });
  };
  private clear(): void { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  private step(p: P, dt: number): void {
    const cfg = this.cfg!;
    p.age += dt;
    if (p.cloud > 0) { p.cloud += dt; if (p.cloud > 2.6) Object.assign(p, this.spawn()); return; }
    const [u, v] = cfg.field(p.lon, p.lat);
    const jitter = cfg.style === 'dust' ? 0.9 : 0.08;
    p.lon += (u + (Math.random() - 0.5) * jitter) * cfg.speed * dt / Math.max(0.3, Math.cos(p.lat * DEG));
    p.lat += (v + (Math.random() - 0.5) * jitter) * cfg.speed * dt;
    p.trail.push(p.lon, p.lat);
    if (p.trail.length > TRAIL * 2) p.trail.splice(0, 2);
    if (cfg.rainZones && cfg.rainZones.some((b) => inBox(p.lon, p.lat, b)) && Math.random() < 0.04) { p.cloud = 0.001; return; }
    if (p.age > p.life || !inBox(p.lon, p.lat, cfg.bounds)) Object.assign(p, this.spawn());
  }
  private draw(dt: number): void {
    const cfg = this.cfg;
    this.clear();
    if (!cfg) return;
    this.frames++;
    const map = this.map;
    const c = map.getCenter();
    const cx = Math.cos(c.lat * DEG) * Math.cos(c.lng * DEG), cy = Math.cos(c.lat * DEG) * Math.sin(c.lng * DEG), cz = Math.sin(c.lat * DEG);
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const minDot = Math.cos(Math.min(map.getZoom() < 3 ? 72 : 82, (3 * 360 * Math.max(W, H)) / (512 * 2 ** map.getZoom())) * DEG);
    const tr: any = (map as any).transform;
    const proj = (lon: number, lat: number): { x: number; y: number } =>
      tr && tr.locationToScreenPoint ? tr.locationToScreenPoint({ lng: lon, lat } as any) : map.project([lon, lat]);
    const visible = (lon: number, lat: number): boolean =>
      Math.cos(lat * DEG) * Math.cos(lon * DEG) * cx + Math.cos(lat * DEG) * Math.sin(lon * DEG) * cy + Math.sin(lat * DEG) * cz > minDot;
    const ctx = this.ctx;
    const now = performance.now() / 1000;
    ctx.lineCap = 'round';
    for (const p of this.ps) {
      if (dt) this.step(p, dt);
      if (!visible(p.lon, p.lat)) continue;
      const fade = Math.min(1, p.age / 0.6, (p.life - p.age) / 0.8);
      if (p.cloud > 0) {
        const s = proj(p.lon, p.lat);
        const a = Math.min(1, p.cloud / 0.5) * Math.max(0, 1 - (p.cloud - 1.8) / 0.8);
        const r = 5 + p.cloud * 3;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.85 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(120,190,255,${0.9 * a})`; ctx.lineWidth = 1.2;
        for (let k = -1; k <= 1; k++) {
          const off = ((now * 30 + k * 7 + p.size * 10) % 14);
          ctx.beginPath(); ctx.moveTo(s.x + k * 4, s.y + 4 + off); ctx.lineTo(s.x + k * 4 - 1, s.y + 9 + off); ctx.stroke();
        }
        continue;
      }
      if (cfg.style === 'dust') {
        const s = proj(p.lon, p.lat);
        ctx.fillStyle = cfg.color.replace('ALPHA', (0.75 * Math.max(0, fade)).toFixed(2));
        ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.strokeStyle = cfg.color.replace('ALPHA', (0.85 * Math.max(0, fade)).toFixed(2));
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < p.trail.length; i += 2) {
        const s = proj(p.trail[i], p.trail[i + 1]);
        if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
    }
  }
}
