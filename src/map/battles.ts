// Battle-site detail scenes. Unit positions are schematic illustrations, not exact troop maps.
import type maplibregl from 'maplibre-gl';
import type { Camera } from '../core/content';

type LL = [number, number];
export interface Unit { side: string; color: string; path: LL[]; start?: number; end?: number; sinkAt?: number }
export interface Stage { at: number; text: string }
export interface Battle {
  id: string; title: string; year: number; lon: number; lat: number; camera: Camera;
  summary: string; modernName: string; stages: Stage[]; units: Unit[]; tags: Array<{ lon: number; lat: number; text: string }>;
  duration: number;
}

const lerp = (a: LL, b: LL, t: number): LL => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export function along(path: LL[], t: number): LL {
  if (path.length === 1) return path[0];
  const x = Math.min(1, Math.max(0, t)) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(x));
  return lerp(path[i], path[i + 1], x - i);
}

const JOSEON = '#3d8bff', JAPAN = '#ff5a4f', BAEKJE = '#7fb0ff', SILLA = '#ffd24a';

function hansanUnits(): Unit[] {
  const units: Unit[] = [];
  // Japanese fleet waits in the narrow Gyeonnaeryang strait, chases the bait south, gets surrounded.
  for (let k = 0; k < 12; k++) {
    const dx = ((k % 4) - 1.5) * 0.006, dy = Math.floor(k / 4) * 0.006;
    units.push({ side: 'japan', color: JAPAN, path: [[128.474 + dx, 34.895 + dy], [128.474 + dx, 34.893 + dy], [128.476 + dx * 1.4, 34.845 + dy], [128.478 + dx * 1.6, 34.822 + dy * 1.3]], sinkAt: 0.72 + (k % 5) * 0.05 });
  }
  // Bait ships lure the enemy out, then join the main line.
  for (let k = 0; k < 4; k++) {
    const dx = (k - 1.5) * 0.005;
    units.push({ side: 'joseon', color: JOSEON, path: [[128.476 + dx, 34.862], [128.476 + dx, 34.878], [128.477 + dx, 34.84], [128.478 + dx, 34.798]], end: 0.55 });
  }
  // Main fleet hidden near Hansan island forms the crane-wing arc around the enemy.
  const cx = 128.478, cy = 34.818, r = 0.032;
  for (let k = 0; k < 14; k++) {
    const ang = Math.PI * (1.05 + (k / 13) * 0.9); // arc open to the north
    const target: LL = [cx + Math.cos(ang) * r * 1.25, cy + Math.sin(ang) * r * 0.9 + 0.006];
    const hide: LL = [128.445 + (k % 3) * 0.004, 34.775 + Math.floor(k / 3) * 0.003];
    units.push({ side: 'joseon', color: JOSEON, path: [hide, hide, hide, lerp(hide, target, 0.6), target, target], start: 0 });
  }
  return units;
}

function hwangsanUnits(): Unit[] {
  const units: Unit[] = [];
  const camps: LL[] = [[127.205, 36.222], [127.218, 36.205], [127.232, 36.214]];
  camps.forEach((c, i) => {
    for (let k = 0; k < 4; k++) units.push({ side: 'baekje', color: BAEKJE, path: [[c[0] + (k % 2) * 0.004, c[1] + Math.floor(k / 2) * 0.003]], sinkAt: 0.85 + i * 0.03 + k * 0.01 });
  });
  for (let k = 0; k < 18; k++) {
    const row = k % 6, col = Math.floor(k / 6);
    const s: LL = [127.33 + col * 0.008, 36.235 - row * 0.006];
    const front: LL = [127.25 + col * 0.006, 36.225 - row * 0.005];
    // Four repulsed attacks, then the final push.
    units.push({ side: 'silla', color: SILLA, path: [s, front, s, front, s, front, s, front, s, [127.225 + col * 0.006, 36.218 - row * 0.004]] });
  }
  return units;
}

export const BATTLES: Battle[] = [
  {
    id: 'hwangsanbeol', title: '황산벌 전투', year: 660, lon: 127.22, lat: 36.21,
    camera: { center: [127.26, 36.21], zoom: 11, pitch: 55, bearing: -20 },
    modernName: '현재 지명: 충청남도 논산시 연산면 일대',
    summary: '660년, 나당 연합군이 백제를 공격했어요. 계백 장군은 결사대 약 5천 명을 이끌고 황산벌의 언덕에 세 개의 진영을 세워 신라군(약 5만 명)을 막았어요.',
    stages: [
      { at: 0, text: '① 백제군은 산자락을 등지고 세 진영을 쳤어요. 길목을 막아 적은 수로 버티려는 작전이에요.' },
      { at: 0.15, text: '② 신라군이 동쪽에서 쳐들어왔지만 네 번이나 밀려났어요.' },
      { at: 0.75, text: '③ 화랑 관창의 희생으로 사기가 오른 신라군이 다섯 번째 공격에 나섰어요.' },
      { at: 0.88, text: '④ 수가 훨씬 적었던 백제군은 끝내 무너졌고, 백제는 곧 멸망했어요.' },
    ],
    units: hwangsanUnits(),
    tags: [{ lon: 127.218, lat: 36.232, text: '백제군 진영(계백)' }, { lon: 127.34, lat: 36.245, text: '신라군(김유신)' }, { lon: 127.27, lat: 36.17, text: '황산벌' }],
    duration: 16,
  },
  {
    id: 'hansando', title: '한산도 대첩', year: 1592, lon: 128.48, lat: 34.8,
    camera: { center: [128.47, 34.825], zoom: 11.3, pitch: 50, bearing: 0 },
    modernName: '현재 지명: 경상남도 통영시 한산면 앞바다',
    summary: '1592년 7월, 이순신이 이끈 조선 수군이 한산도 앞바다에서 일본 수군을 크게 물리쳤어요. 임진왜란의 흐름을 바꾼 바다 싸움이에요.',
    stages: [
      { at: 0, text: '① 일본 배들은 좁고 암초가 많은 견내량에 머물러 있었어요. 큰 배가 싸우기 어려운 곳이에요.' },
      { at: 0.2, text: '② 조선의 배 몇 척이 일부러 다가갔다가 달아나며 적을 넓은 바다로 끌어냈어요.' },
      { at: 0.45, text: '③ 숨어 있던 본대가 학의 날개처럼 반원으로 펼쳐 적을 둘러쌌어요(학익진).' },
      { at: 0.7, text: '④ 둘러싼 배들이 한꺼번에 화포를 쏘아 일본 배 대부분을 무찔렀어요.' },
    ],
    units: hansanUnits(),
    tags: [{ lon: 128.474, lat: 34.905, text: '견내량' }, { lon: 128.44, lat: 34.765, text: '한산도' }, { lon: 128.52, lat: 34.81, text: '학익진' }],
    duration: 18,
  },
];

/** Feature collections for a battle at normalized time t (0..1). */
export function battleFrame(b: Battle, t: number): { units: any; paths: any } {
  const units = b.units.map((u) => {
    const s = u.start ?? 0, e = u.end ?? 1;
    const local = Math.min(1, Math.max(0, (t - s) / (e - s)));
    const pos = along(u.path, local);
    const sunk = u.sinkAt != null && t > u.sinkAt;
    const op = sunk ? Math.max(0.15, 1 - (t - u.sinkAt!) * 8) : 1;
    return { type: 'Feature', geometry: { type: 'Point', coordinates: pos }, properties: { color: sunk ? '#555' : u.color, op } };
  });
  const paths = b.units.filter((u) => u.path.length > 1 && u.side !== 'baekje').filter((_, i) => i % 3 === 0).map((u) => ({
    type: 'Feature', geometry: { type: 'LineString', coordinates: u.path.filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]) }, properties: { color: u.color },
  })).filter((f) => f.geometry.coordinates.length > 1);
  return { units: { type: 'FeatureCollection', features: units }, paths: { type: 'FeatureCollection', features: paths } };
}

export function stageAt(b: Battle, t: number): Stage {
  let s = b.stages[0];
  for (const x of b.stages) if (t >= x.at) s = x;
  return s;
}

export function clearBattle(map: maplibregl.Map): void {
  const empty = { type: 'FeatureCollection', features: [] } as any;
  (map.getSource('battleUnits') as any)?.setData(empty);
  (map.getSource('battlePaths') as any)?.setData(empty);
}
