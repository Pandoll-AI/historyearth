import type { Page } from '@playwright/test';

// Overlay layout rules: 8px grid, 16px outer margin, 8px gaps, 40px controls in a row.
export const GRID = 8;
export const MARGIN = 16;

export interface Box { x: number; y: number; w: number; h: number }

/** Collects layout problems of the HUD overlays in the current page state. */
export async function auditLayout(page: Page): Promise<string[]> {
  return page.evaluate(({ GRID, MARGIN }) => {
    const issues: string[] = [];
    const W = window.innerWidth, H = window.innerHeight;
    const vis = (el: Element | null): el is HTMLElement => {
      if (!el) return false;
      const s = getComputedStyle(el as HTMLElement);
      if (s.display === 'none' || s.visibility === 'hidden' || (el as HTMLElement).hidden) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const box = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const q = (s: string) => document.querySelector(s);
    const near = (a: number, b: number, tol = 0.75) => Math.abs(a - b) <= tol;
    const name = (el: Element) => el.id ? `#${el.id}` : `.${[...el.classList].join('.')}`;

    // 1) every visible control stays inside the viewport with at least half a grid step of air
    const controls = [...document.querySelectorAll('#hud .btn, #hud .sel, #search, .badge, #year, #panel, #browse, #play-btn, #slider, .maplibregl-ctrl-group, .maplibregl-ctrl-attrib')];
    for (const el of controls) {
      if (!vis(el)) continue;
      const b = box(el);
      if (b.x < GRID / 2 - 0.5 || b.y < GRID / 2 - 0.5 || b.r > W - GRID / 2 + 0.5 || b.b > H - GRID / 2 + 0.5) issues.push(`outside viewport: ${name(el)} ${Math.round(b.x)},${Math.round(b.y)}-${Math.round(b.r)},${Math.round(b.b)}`);
    }
    // tick labels must not be clipped by the viewport
    for (const t of document.querySelectorAll('#ticks span')) {
      if (!vis(t)) continue;
      const b = box(t);
      if (b.x < 0 || b.r > W) issues.push(`tick clipped: ${t.textContent}`);
    }
    // 2) outer margins on the grid
    const edge = (sel: string, side: 'l' | 'r' | 't', want: number) => {
      const el = q(sel); if (!vis(el)) return;
      const b = box(el); const got = side === 'l' ? b.x : side === 'r' ? W - b.r : b.y;
      if (!near(got, want)) issues.push(`margin ${side} of ${sel}: ${got.toFixed(1)} (want ${want})`);
    };
    edge('#hud-tl', 'l', MARGIN); edge('#hud-tl', 't', MARGIN);
    edge('#menu-btn', 'r', MARGIN); edge('#menu-btn', 't', MARGIN);
    if (getComputedStyle(q('#menu-btn')!).display === 'none') { edge('#hud-tr', 'r', MARGIN); edge('#hud-tr', 't', MARGIN); }
    edge('#play-btn', 'l', MARGIN); edge('.track', 'r', MARGIN);
    edge('#eras', 'l', MARGIN);
    edge('#panel', 'l', MARGIN);
    edge('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group', 'r', MARGIN);
    // 3) rows: equal heights and 8px gaps
    const rowCheck = (label: string, items: HTMLElement[], wantH?: number) => {
      const v = items.filter(vis);
      for (let i = 0; i < v.length; i++) {
        const b = box(v[i]);
        if (wantH && !near(b.h, wantH)) issues.push(`${label}: ${name(v[i])} height ${b.h.toFixed(1)} (want ${wantH})`);
        if (i > 0) {
          const p = box(v[i - 1]);
          if (near(p.y, b.y, 2)) { if (!near(b.x - p.r, GRID)) issues.push(`${label}: gap ${name(v[i - 1])}→${name(v[i])} ${(b.x - p.r).toFixed(1)} (want ${GRID})`); }
          if (!near(p.h, b.h)) issues.push(`${label}: height mismatch ${name(v[i - 1])} ${p.h.toFixed(1)} vs ${name(v[i])} ${b.h.toFixed(1)}`);
        }
      }
    };
    document.querySelectorAll<HTMLElement>('#hud-tr .row').forEach((row, i) => rowCheck(`hud row ${i + 1}`, [...row.children].map((c) => (c.classList.contains('search-wrap') ? c.querySelector('#search') as HTMLElement : c as HTMLElement)), 40));
    rowCheck('badges', [...document.querySelectorAll<HTMLElement>('.badges .badge')]);
    rowCheck('eras', [...document.querySelectorAll<HTMLElement>('#eras .btn')].slice(0, 6), 32);
    const rows = [...document.querySelectorAll('#hud-tr .row')].filter(vis);
    for (let i = 1; i < rows.length; i++) { const g = box(rows[i]).y - box(rows[i - 1]).b; if (!near(g, GRID)) issues.push(`hud row gap ${g.toFixed(1)} (want ${GRID})`); }
    // 4) blocks must not overlap and keep at least one grid step apart
    const blocks: Array<[string, Element | null]> = [
      ['hud-tl', q('#hud-tl')], ['hud-tr', getComputedStyle(q('#menu-btn')!).display === 'none' ? q('#hud-tr') : q('#menu-btn')],
      ['panel', q('#panel')], ['browse', q('#browse')], ['eras', q('#eras')], ['timeline', q('.timeline')],
      ['zoom', q('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group')], ['credits', q('.maplibregl-ctrl-attrib')],
    ];
    const shown = blocks.filter(([, el]) => vis(el)) as Array<[string, HTMLElement]>;
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
      const a = box(shown[i][1]), b = box(shown[j][1]);
      const dx = Math.max(b.x - a.r, a.x - b.r), dy = Math.max(b.y - a.b, a.y - b.b);
      const gap = Math.max(dx, dy);
      if (gap < 0) issues.push(`overlap: ${shown[i][0]} × ${shown[j][0]}`);
      else if (gap < GRID - 0.75 && !(shown[i][0] === 'eras' && shown[j][0] === 'timeline') && !(shown[i][0] === 'zoom' && shown[j][0] === 'credits')) issues.push(`too close (${gap.toFixed(1)}px): ${shown[i][0]} × ${shown[j][0]}`);
    }
    return issues;
  }, { GRID, MARGIN });
}

export const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900, touch: false },
  { name: 'laptop-1280', width: 1280, height: 800, touch: false },
  { name: 'tablet-1024', width: 1024, height: 768, touch: true },
  { name: 'phone-390', width: 390, height: 844, touch: true },
  { name: 'phone-844', width: 844, height: 390, touch: true },
];
