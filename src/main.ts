import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import maplibregl from 'maplibre-gl';
import { createMap } from './map/globe';
import { LabelLayer, escapeHtml, type LabelItem } from './map/labels';
import { ParticleLayer, type ParticleConfig } from './map/particles';
import { drawHeat, drawNight, setLayerVisible } from './map/overlays';
import { BATTLES, battleFrame, clearBattle, stageAt, type Battle } from './map/battles';
import { Store, defaultState, type AppState, type LayerId } from './core/store';
import { BorderData } from './core/borders';
import { ERA_BUTTONS, PLACES, DEEP_TIME, GEO_LABELS, type Camera } from './core/content';
import { search, type PolityLabel, type SearchHit } from './core/search';
import { currentYear, formatYear, koreanEra, normalizeYear, sliderToYear, yearToSlider, MIN_YEAR } from './core/time';
import { monsoonJanuary, monsoonJuly, siberianHigh, springWesterlies, SOURCES, RAIN_ZONES } from './climate/winds';
import { TEMP_MAX, TEMP_MIN, tempColor, type TempGrid } from './climate/temperature';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const NOW = currentYear();
const KOREA_CAM: Camera = { center: [127.6, 37.4], zoom: 5.2, pitch: 0, bearing: 0 };
// Default history view: East Asia seen from nearly straight above.
const HISTORY_CAM: Camera = { center: [120, 37], zoom: window.innerWidth < 760 ? 2.7 : 3.4, pitch: 0, bearing: 0 };
const WORLD_CAM: Camera = { center: [115, 25], zoom: 1.6, pitch: 0, bearing: 0 };

const params = new URLSearchParams(location.search);
const startYear = normalizeYear(Number(params.get('year')) || 475, NOW);
const store = new Store(defaultState(startYear));
const data = new BorderData('/data');
const map = createMap($('map'));
// Tile fetch/decode failures are transient network issues; keep them out of the error console.
map.on('error', (e: any) => console.warn('map:', e?.error?.message ?? e));
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
const overlay = $('overlay');
const histLabels = new LabelLayer(map, overlay);
const extraLabels = new LabelLayer(map, overlay, 'labels extra');
const particles = new ParticleLayer(map, overlay);
let polities: PolityLabel[] = [];
let tempGrid: TempGrid | null = null;
let modernLabelItems: LabelItem[] = [];
let ready = false;

function fly(c: Camera, duration = 2600): void {
  map.flyTo({ center: c.center, zoom: c.zoom, pitch: c.pitch ?? 0, bearing: c.bearing ?? 0, duration, essential: true, curve: 1.5 });
}

// ---------- year, borders, labels ----------
let appliedSnapshot: number | null = null;
let loadToken = 0;
async function applyBorders(year: number): Promise<void> {
  const snap = data.snapshot(year);
  const kr = data.koreaAt(year);
  (map.getSource('korea') as any)?.setData({ type: 'FeatureCollection', features: kr });
  const hideKr = kr.length > 0;
  for (const id of ['hist-fill', 'hist-line', 'hist-casing']) map.setFilter(id, hideKr ? ['!=', ['get', 'kr'], 1] : null);
  if (snap !== appliedSnapshot) {
    const token = ++loadToken;
    const fc = await data.load(snap);
    if (token !== loadToken) return;
    appliedSnapshot = snap;
    (map.getSource('hist') as any)?.setData(fc);
    polities = fc.features.map((f) => f.properties as PolityLabel);
  }
  updateHistLabels(year);
}

const inKorea = (lon: number, lat: number): boolean => lon > 124 && lon < 131 && lat > 33 && lat < 43;
function updateHistLabels(year: number): void {
  const kr = data.koreaAt(year);
  const items: LabelItem[] = kr.map((f) => ({ id: `kr-${f.properties.id}`, lon: f.properties.lx, lat: f.properties.ly, text: f.properties.k, cls: 'kr', pri: 1e9 }));
  const hideKr = kr.length > 0;
  const seen = new Set<string>();
  for (const p of [...polities].sort((a, b) => b.a - a.a)) {
    if (!p.k || p.a < 2500 || (hideKr && (p as any).kr === 1)) continue;
    const key = `${p.k}@${Math.round(p.lx)},${Math.round(p.ly)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const band = /수렵|유목|농경|어로|문화|민$|족$/.test(p.k);
    items.push({ id: `h-${key}`, lon: p.lx, lat: p.ly, text: p.k, cls: band ? 'band' : '', pri: p.a });
    if (items.length > 260) break;
  }
  for (const [i, g] of GEO_LABELS.entries()) {
    if ((g.from ?? -9999) > year || (g.to ?? 9999) < year) continue;
    items.push({ id: `g-${i}`, lon: g.lon, lat: g.lat, text: g.text, cls: g.kind, pri: g.kind === 'city' ? 4e5 : g.kind === 'river' ? 2e5 : 1.5e5, minZoom: g.minZoom ?? (inKorea(g.lon, g.lat) ? 4.6 : 3.2) });
  }
  if (store.get().modernBorders) items.push(...modernLabelItems);
  histLabels.setItems(items);
}

function renderYear(s: AppState): void {
  $('year').textContent = formatYear(s.year);
  const era = koreanEra(s.year);
  $('era-badge').textContent = `한국: ${era.name}`;
  $('era-badge').title = era.detail;
  const slider = $<HTMLInputElement>('slider');
  if (Number(slider.value) !== yearToSlider(s.year)) slider.value = String(yearToSlider(s.year));
  document.querySelectorAll<HTMLButtonElement>('#eras .btn').forEach((b) => {
    const e = ERA_BUTTONS.find((x) => x.id === b.dataset.id);
    b.classList.toggle('on', !!e && normalizeYear(e.year, NOW) === s.year);
  });
  updateBattleMarkers(s.year);
}

// ---------- seoul clock + weather (Open-Meteo, no key) ----------
const WMO: Record<number, string> = { 0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '안개', 51: '이슬비', 53: '이슬비', 55: '이슬비', 61: '비', 63: '비', 65: '강한 비', 71: '눈', 73: '눈', 75: '많은 눈', 80: '소나기', 81: '소나기', 82: '강한 소나기', 95: '뇌우' };
let weather = '';
function tickClock(): void {
  const t = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  $('seoul-badge').textContent = `서울 ${t}${weather ? ` · ${weather}` : ''}`;
}
async function loadWeather(): Promise<void> {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.57&longitude=126.98&current=temperature_2m,weather_code&timezone=Asia%2FSeoul');
    const j = await r.json();
    weather = `${WMO[j.current.weather_code] ?? '날씨'} ${Math.round(j.current.temperature_2m)}°C`;
  } catch { weather = ''; }
  tickClock();
}

// ---------- lighting ----------
let nightTimer = 0;
function applyLighting(s: AppState): void {
  window.clearInterval(nightTimer);
  const before = map.getLayer('hist-fill') ? 'hist-fill' : undefined;
  if (s.lighting === 'real') {
    drawNight(map, new Date(), before);
    setLayerVisible(map, 'night', true);
    nightTimer = window.setInterval(() => drawNight(map, new Date(), before), 60000);
  } else setLayerVisible(map, 'night', false);
  for (const id of ['sat', 'bm']) map.setPaintProperty(id, 'raster-brightness-max', s.lighting === 'night' ? 0.32 : 1);
  map.setPaintProperty('shade', 'hillshade-exaggeration', s.lighting === 'night' ? 0.2 : 0.55);
}

// ---------- climate layers ----------
const CLIMATE_LABELS: Record<Exclude<LayerId, 'geo'>, LabelItem[]> = {
  monsoon: [],
  dust: [
    { id: 'c-gobi', lon: 106, lat: 44.5, text: '고비 사막', cls: 'climate', pri: 10 },
    { id: 'c-takla', lon: 83, lat: 39.6, text: '타클라마칸 사막', cls: 'climate', pri: 10 },
    { id: 'c-jet', lon: 118, lat: 41.5, text: '편서풍(제트 기류) →', cls: 'climate', pri: 11 },
    { id: 'c-kor', lon: 127.8, lat: 36.4, text: '한반도', cls: 'climate', pri: 9 },
    { id: 'c-jp', lon: 138, lat: 36.5, text: '일본', cls: 'climate', pri: 8 },
  ],
  temp: [
    { id: 'c-sib', lon: 102, lat: 52, text: '시베리아 고기압', cls: 'climate', pri: 10 },
    { id: 'c-nw', lon: 118, lat: 44, text: '북서 계절풍 ↘', cls: 'climate', pri: 9 },
  ],
};
function monsoonLabels(month: 'jul' | 'jan'): LabelItem[] {
  return month === 'jul'
    ? [
        { id: 'm1', lon: 66, lat: 12, text: '남서 계절풍 ↗', cls: 'climate', pri: 10 },
        { id: 'm2', lon: 128, lat: 22, text: '남동 계절풍 ↑', cls: 'climate', pri: 10 },
        { id: 'm3', lon: 86, lat: 31.5, text: '히말라야산맥(비구름이 막힘)', cls: 'climate', pri: 11 },
        { id: 'm4', lon: 126, lat: 33, text: '장마 전선', cls: 'climate', pri: 9 },
      ]
    : [
        { id: 'm5', lon: 112, lat: 47, text: '북서 계절풍 ↘', cls: 'climate', pri: 10 },
        { id: 'm6', lon: 80, lat: 20, text: '북동 계절풍 ↙(건조)', cls: 'climate', pri: 10 },
      ];
}

function particleConfig(s: AppState): ParticleConfig | null {
  if (s.layer === 'monsoon') {
    return s.monsoonMonth === 'jul'
      ? { field: monsoonJuly, sources: SOURCES.monsoonJul, count: 1300, speed: 3.2, life: [6, 11], color: 'rgba(170,230,255,ALPHA)', style: 'trail', bounds: [35, -15, 160, 55], rainZones: RAIN_ZONES }
      : { field: monsoonJanuary, sources: SOURCES.monsoonJan, count: 1100, speed: 3.2, life: [6, 11], color: 'rgba(225,240,255,ALPHA)', style: 'trail', bounds: [35, -15, 170, 60] };
  }
  if (s.layer === 'dust') return { field: springWesterlies, sources: SOURCES.dust, count: 1400, speed: 3.0, life: [12, 20], color: 'rgba(222,178,92,ALPHA)', style: 'dust', bounds: [70, 25, 160, 52] };
  if (s.layer === 'temp' && s.tempMode !== 'jul') return { field: siberianHigh, sources: SOURCES.siberia, count: 700, speed: 3.0, life: [6, 10], color: 'rgba(200,235,255,ALPHA)', style: 'trail', bounds: [60, 10, 170, 70] };
  return null;
}

function legendHtml(s: AppState): string {
  const stops = Array.from({ length: 13 }, (_, i) => TEMP_MIN + i * 5).map((t) => `rgb(${tempColor(t).join(',')})`).join(',');
  const lab = s.tempMode === 'range' ? ['0', '15', '30', '45', '60°C 차이'] : ['-30', '-15', '0', '15', '30°C'];
  return `<div class="legend-bar" style="background:linear-gradient(90deg,${stops})"></div><div class="legend-scale">${lab.map((x) => `<span>${x}</span>`).join('')}</div>`;
}

const OROGRAPHIC_SVG = `<svg viewBox="0 0 320 150" role="img" aria-label="지형성 강우 단면 그림">
<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9fdcff"/></marker></defs>
<rect x="0" y="118" width="110" height="32" fill="#1d5f8c"/><text x="8" y="140" fill="#cfe9ff" font-size="11">인도양(바다)</text>
<path d="M90 130 L150 118 L200 40 L215 30 L232 45 L250 70 L320 76 L320 150 L90 150 z" fill="#6b5a40"/>
<path d="M200 40 L215 30 L232 45 L222 48 z" fill="#f2f2f2"/>
<path d="M10 108 C60 106 110 104 150 98" stroke="#9fdcff" stroke-width="2.5" fill="none" marker-end="url(#ar)"/>
<path d="M155 95 C170 80 182 62 196 40" stroke="#9fdcff" stroke-width="2.5" fill="none" marker-end="url(#ar)"/>
<path d="M238 30 C258 40 276 52 300 58" stroke="#e7c98a" stroke-width="2.5" fill="none" marker-end="url(#ar)" stroke-dasharray="5 3"/>
<ellipse cx="180" cy="38" rx="34" ry="13" fill="#e9eef5"/><ellipse cx="160" cy="48" rx="22" ry="10" fill="#dfe6ef"/>
<g stroke="#6fb8ff" stroke-width="1.6">${[150, 160, 170, 180, 190].map((x) => `<line x1="${x}" y1="58" x2="${x - 4}" y2="${74 + (x % 3) * 4}"/>`).join('')}</g>
<text x="104" y="22" fill="#fff" font-size="11">습한 공기가 오르며 식어 비</text>
<text x="244" y="22" fill="#e7c98a" font-size="11">건조한 바람</text>
<text x="252" y="96" fill="#eadbc0" font-size="10">티베트고원</text><text x="182" y="112" fill="#eadbc0" font-size="10">히말라야</text>
</svg>`;

function renderLayerPanel(s: AppState): void {
  const p = $('panel');
  if (s.battle) return;
  p.classList.toggle('geo', s.layer === 'geo');
  if (s.layer === 'geo') {
    p.hidden = false;
    p.innerHTML = `<h3>지리·역사</h3>
      <p>아래 막대를 움직이면 그 해의 나라 경계가 바뀌어요. 한반도의 나라들은 이 앱에서 따로 그린 <b>대략적인 범위</b>예요.</p>
      <div class="ctrl"><label for="exag">지형 과장 <b id="exag-v">${s.exaggeration}배</b></label></div>
      <input id="exag" type="range" min="1" max="5" step="0.5" value="${s.exaggeration}" aria-label="지형 과장 배율" />
      <p class="muted">전투 표시(⚔)를 누르면 자세한 장면을 볼 수 있어요. 오른쪽 아래 버튼으로 기울이거나 돌려 보세요.</p>`;
    $<HTMLInputElement>('exag').oninput = (e) => store.set({ exaggeration: Number((e.target as HTMLInputElement).value) });
    return;
  }
  p.hidden = false;
  const playBtn = `<button id="lp-play" class="btn">${s.playing ? '⏸ 정지' : '▶ 재생'}</button>`;
  if (s.layer === 'monsoon') {
    const jul = s.monsoonMonth === 'jul';
    p.innerHTML = `<h3>몬순(계절풍)</h3>
      <div class="ctrl"><button class="btn ${jul ? 'on' : ''}" data-m="jul">7월(여름)</button><button class="btn ${!jul ? 'on' : ''}" data-m="jan">1월(겨울)</button>${playBtn}</div>
      ${jul
        ? `<p>여름에는 땅이 바다보다 빨리 뜨거워져요. 데워진 땅 위 공기가 위로 올라가면, 바다의 축축한 공기가 그 빈자리로 밀려 들어와요. 이 바람이 <b>여름 계절풍</b>이에요.</p>
           <p>인도에서는 남서쪽 바다에서 불어온 바람이 히말라야에 부딪혀 산 앞쪽에 엄청난 비를 뿌려요. 우리나라에는 남쪽 바다의 습한 바람과 장마 전선이 비를 몰고 와요.</p>
           ${OROGRAPHIC_SVG}
           <p class="muted">하늘색 선은 큰 강(갠지스·브라마푸트라·창장 등)이에요. 여름비가 이 강들을 채워요.</p>`
        : `<p>겨울에는 땅이 바다보다 빨리 식어요. 대륙 위에 차갑고 무거운 공기가 쌓이면 바다 쪽으로 흘러 나가요. 이것이 <b>겨울 계절풍</b>이에요.</p>
           <p>우리나라에는 북서쪽에서 차고 건조한 바람이 불고, 인도에는 북동쪽에서 마른 바람이 불어 비가 거의 오지 않아요.</p>`}
      <p class="muted">바람 모양은 교과서 수준으로 단순하게 그린 그림이에요. 실제 관측값이 아니에요.</p>`;
    p.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => (b.onclick = () => store.set({ monsoonMonth: b.dataset.m as 'jul' | 'jan' })));
  } else if (s.layer === 'dust') {
    p.innerHTML = `<h3>봄철 황사</h3><div class="ctrl">${playBtn}</div>
      <p>겨우내 얼어 있던 고비 사막과 타클라마칸 사막의 땅이 봄에 녹아 푸석해지면, 강한 바람에 흙먼지가 높이 날아올라요. 이 먼지가 하늘 높은 곳의 <b>편서풍</b>을 타고 동쪽으로 며칠 만에 한반도와 일본까지 와요.</p>
      <table><tr><th></th><th>황사</th><th>미세먼지</th></tr>
      <tr><td>어디서</td><td>사막·메마른 땅의 흙</td><td>자동차, 공장, 난방, 불 피우기 등 (자연에서도 일부)</td></tr>
      <tr><td>크기</td><td>비교적 굵은 흙 알갱이가 많아요</td><td>머리카락 굵기보다 훨씬 작아요(PM10, PM2.5)</td></tr>
      <tr><td>언제</td><td>주로 봄(3~5월)</td><td>사계절, 특히 겨울·봄에 자주</td></tr></table>
      <p class="muted">먼지 입자의 움직임은 이해를 돕기 위한 단순화한 그림이에요.</p>`;
  } else {
    const m = s.tempMode;
    p.innerHTML = `<h3>기온</h3>
      <div class="ctrl"><button class="btn ${m === 'jan' ? 'on' : ''}" data-t="jan">1월</button><button class="btn ${m === 'jul' ? 'on' : ''}" data-t="jul">7월</button><button class="btn ${m === 'range' ? 'on' : ''}" data-t="range">연교차</button></div>
      ${legendHtml(s)}
      <div class="ctrl"><label for="tth">${m === 'range' ? '찾을 기온 차이' : '찾을 기온'} <b id="tth-v"></b></label></div>
      <input id="tth" type="range" min="${TEMP_MIN}" max="${TEMP_MAX}" step="1" value="${s.tempThreshold}" aria-label="찾을 기온" />
      <p>${m === 'jan' ? '1월에는 <b>시베리아 고기압</b>에서 차가운 북서 계절풍이 불어와요. 그래서 우리나라 겨울은 같은 위도의 유럽보다 훨씬 추워요.'
        : m === 'jul' ? '7월에는 적도 근처와 대륙 안쪽 사막이 가장 뜨거워요. 우리나라도 덥고 습한 여름이에요.'
        : '연교차는 가장 더운 달과 가장 추운 달의 기온 차이예요. 바다에서 멀고 대륙 안쪽일수록 커요. 우리나라는 대륙 동쪽 끝에 있어 연교차가 큰 편이에요.'}</p>
      <p class="muted">막대를 움직이면 그 값 근처(±2.5°C)인 곳만 진하게 보여요. 자료: Open-Meteo(ERA5 재분석) 2024년 1월·7월 평균을 6° 간격으로 뽑아 부드럽게 이은 단순화 자료.</p>`;
    const th = $<HTMLInputElement>('tth');
    const showTh = (): void => { const v = Number(th.value); $('tth-v').textContent = m === 'range' ? `${v + 30}°C 차이` : `${v}°C`; };
    showTh();
    th.oninput = () => { showTh(); store.set({ tempThreshold: Number(th.value) }); };
    p.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => (b.onclick = () => store.set({ tempMode: b.dataset.t as any })));
  }
  const pb = document.getElementById('lp-play');
  if (pb) pb.onclick = () => store.set({ playing: !store.get().playing });
}

let heatTouched = false;
function applyLayer(s: AppState, prev: AppState | null): void {
  const geo = s.layer === 'geo';
  for (const id of ['hist-fill', 'hist-line', 'hist-casing', 'korea-fill', 'korea-line', 'korea-casing']) setLayerVisible(map, id, geo);
  histLabels.setVisible(geo || s.modernBorders);
  setLayerVisible(map, 'rivers', geo || s.layer === 'monsoon');
  setLayerVisible(map, 'jet', s.layer === 'dust');
  if (s.layer === 'temp' && tempGrid) {
    const touched = heatTouched || (prev != null && prev.tempThreshold !== s.tempThreshold);
    heatTouched = touched;
    drawHeat(map, tempGrid, s.tempMode, touched ? s.tempThreshold : null, 'hist-fill');
    setLayerVisible(map, 'heat', true);
  } else setLayerVisible(map, 'heat', false);
  const climateLabels = s.layer === 'geo' ? [] : s.layer === 'monsoon' ? monsoonLabels(s.monsoonMonth) : CLIMATE_LABELS[s.layer];
  extraLabels.setItems([...climateLabels, ...(geo ? [] : modernLabelItems.filter((m) => m.pri >= 0))]);
  particles.set(particleConfig(s));
  particles.setRunning(s.playing);
  renderLayerPanel(s);
}

// ---------- battles ----------
const battleMarkers = new Map<string, maplibregl.Marker>();
function updateBattleMarkers(year: number): void {
  for (const b of BATTLES) {
    const m = battleMarkers.get(b.id)!;
    const st = store.get();
    const show = st.layer === 'geo' && !st.battle && Math.abs(year - b.year) <= 150;
    m.getElement().style.display = show ? '' : 'none';
  }
}
let battleRaf = 0;
let battleStart = 0;
function openBattle(b: Battle): void {
  store.set({ battle: b.id, year: b.year, layer: 'geo' });
  updateBattleMarkers(b.year);
  fly(b.camera, 3000);
  const p = $('panel');
  p.hidden = false;
  p.classList.remove('geo');
  p.innerHTML = `<button class="btn icon close" id="b-close" aria-label="닫기">✕</button><h3>⚔ ${b.title} (${b.year}년)</h3>
    <p>${b.summary}</p><p class="muted">${b.modernName}</p>
    <div class="stage" id="b-stage"></div>
    <div class="ctrl"><button class="btn" id="b-replay">↻ 다시 보기</button></div>
    <p class="muted">점의 위치와 움직임은 이해를 돕기 위한 그림이에요. 파란·노란 점: ${b.id === 'hansando' ? '조선 수군(파랑), 일본 수군(빨강)' : '백제군(하늘색), 신라군(노랑)'}</p>`;
  $('b-close').onclick = closeBattle;
  $('b-replay').onclick = () => { battleStart = performance.now() + 300; runBattle(b); };
  extraLabels.setItems(b.tags.map((t, i) => ({ id: `bt-${i}`, lon: t.lon, lat: t.lat, text: t.text, cls: 'tag', pri: 100 - i })));
  battleStart = performance.now() + 3000;
  runBattle(b);
}
let battleLastUpdate = 0;
function runBattle(b: Battle): void {
  cancelAnimationFrame(battleRaf);
  let done = false;
  const tick = (now: number): void => {
    battleRaf = 0;
    const t = Math.min(1, Math.max(0, (now - battleStart) / 1000 / b.duration));
    if (now - battleLastUpdate > 80) {
      battleLastUpdate = now;
      const fr = battleFrame(b, t);
      (map.getSource('battleUnits') as any).setData(fr.units);
      (map.getSource('battlePaths') as any).setData(fr.paths);
      const st = document.getElementById('b-stage');
      if (st) st.textContent = stageAt(b, t).text;
      done = t >= 1;
    }
    if (!done) battleRaf = requestAnimationFrame(tick);
  };
  battleRaf = requestAnimationFrame(tick);
}
function closeBattle(): void {
  cancelAnimationFrame(battleRaf);
  clearBattle(map);
  extraLabels.setItems([]);
  store.set({ battle: null });
  updateBattleMarkers(store.get().year);
  renderLayerPanel(store.get());
}

// ---------- search & browse ----------
function goHit(h: SearchHit): void {
  $('search-results').hidden = true;
  closeMenu();
  const battle = BATTLES.find((b) => b.id === h.placeId);
  if (battle) { openBattle(battle); return; }
  if (h.year != null) store.set({ year: normalizeYear(h.year, NOW) });
  if (store.get().layer !== 'geo') store.set({ layer: 'geo' });
  fly({ center: [h.lon, h.lat], zoom: h.zoom, pitch: h.zoom > 6 ? 50 : 25 });
  const p = $('panel');
  p.hidden = false;
  p.classList.remove('geo');
  p.innerHTML = `<button class="btn icon close" id="p-close" aria-label="닫기">✕</button><h3>${escapeHtml(h.label)}</h3>${h.year != null ? `<p class="muted">${formatYear(h.year)}</p>` : ''}<p>${escapeHtml(h.sub || '')}</p>`;
  $('p-close').onclick = () => renderLayerPanel(store.get());
}
let activeHit = 0;
let lastHits: SearchHit[] = [];
function renderSearch(): void {
  const q = $<HTMLInputElement>('search').value;
  lastHits = search(q, PLACES, polities);
  const box = $('search-results');
  if (!q.trim()) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = lastHits.length
    ? lastHits.map((h, i) => `<button role="option" data-i="${i}" class="${i === activeHit ? 'active' : ''}"><span class="k">${h.kind}</span>${escapeHtml(h.label)}${h.year != null ? ` · ${formatYear(h.year)}` : ''}<span class="s">${escapeHtml(h.sub).slice(0, 60)}</span></button>`).join('')
    : '<div style="padding:10px;color:#aeb8c8">찾는 결과가 없어요. 다른 이름으로 찾아보세요.</div>';
  box.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => goHit(lastHits[Number(b.dataset.i)])));
}
function renderBrowse(): void {
  const el = $('browse');
  const group = (kind: string): string => PLACES.filter((p) => p.kind === kind).map((p) => `<button class="btn" data-p="${p.id}">${p.name}</button>`).join('');
  el.innerHTML = `<button class="btn icon close" id="br-close" aria-label="닫기">✕</button><h3>찾아볼 수 있는 곳</h3>
    <h4>전투</h4>${group('전투')}<h4>사건</h4>${group('사건')}<h4>장소</h4>${group('장소')}
    <h4>아주 먼 옛날(지구의 역사)</h4>${DEEP_TIME.map((d, i) => `<button class="btn" data-d="${i}">${d.label}</button>`).join('')}
    <p class="muted">검색 칸에 지금 화면 연도의 나라 이름(예: 로마, 몽골)을 써도 찾아가요.</p>`;
  $('br-close').onclick = () => { el.hidden = true; $('browse-btn').classList.remove('on'); };
  el.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => (b.onclick = () => {
    const p = PLACES.find((x) => x.id === b.dataset.p)!;
    el.hidden = true; $('browse-btn').classList.remove('on');
    goHit({ kind: p.kind, label: p.name, sub: p.desc, lon: p.lon, lat: p.lat, zoom: p.zoom, year: p.year, placeId: p.id });
  }));
  el.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => (b.onclick = () => {
    const d = DEEP_TIME[Number(b.dataset.d)];
    el.hidden = true; $('browse-btn').classList.remove('on');
    store.set({ battle: null });
    fly(WORLD_CAM);
    const p = $('panel'); p.hidden = false; p.classList.remove('geo');
    p.innerHTML = `<button class="btn icon close" id="p-close" aria-label="닫기">✕</button><h3>🌍 ${d.label}</h3><p class="muted">${d.ago}</p><p>${d.text}</p>
      <p class="muted">이 시기에는 지금과 대륙 모양이 달랐어요. 지구본은 오늘날 모습 그대로 보여 줘요(아주 먼 옛날 지도는 아직 없어요).</p>
      <div class="ctrl">${DEEP_TIME.map((x, i) => `<button class="btn ${x === d ? 'on' : ''}" data-dd="${i}">${x.label}</button>`).join('')}</div>`;
    $('p-close').onclick = () => renderLayerPanel(store.get());
    p.querySelectorAll<HTMLButtonElement>('[data-dd]').forEach((x) => (x.onclick = () => (el.querySelector(`[data-d="${x.dataset.dd}"]`) as HTMLButtonElement).click()));
  }));
}
function closeMenu(): void { $('hud-tr').classList.remove('open'); $('menu-btn').setAttribute('aria-expanded', 'false'); }

// ---------- UI wiring ----------
function buildUi(): void {
  const slider = $<HTMLInputElement>('slider');
  slider.min = String(yearToSlider(MIN_YEAR));
  slider.max = String(NOW);
  slider.step = '1';
  slider.value = String(yearToSlider(store.get().year));
  slider.addEventListener('input', () => store.set({ year: normalizeYear(sliderToYear(Number(slider.value)), NOW) }));
  const ticks = [-3000, -2000, -1000, 1, 500, 1000, 1500, 2000];
  const span = NOW - yearToSlider(MIN_YEAR);
  $('ticks').innerHTML = ticks.map((t) => `<span style="left:${((yearToSlider(t) - yearToSlider(MIN_YEAR)) / span) * 100}%">${t < 0 ? `BC${-t}` : t === 1 ? 'AD1' : t}</span>`).join('');

  $('eras').innerHTML = ERA_BUTTONS.map((e) => `<button class="btn" data-id="${e.id}" title="${formatYear(normalizeYear(e.year, NOW))}">${e.label}</button>`).join('');
  $('eras').querySelectorAll<HTMLButtonElement>('.btn').forEach((b) => (b.onclick = () => {
    const e = ERA_BUTTONS.find((x) => x.id === b.dataset.id)!;
    if (store.get().battle) closeBattle();
    store.set({ year: normalizeYear(e.year, NOW), layer: 'geo' });
    $('era-note').textContent = e.note;
    fly(e.camera);
  }));

  let playTimer = 0;
  $('play-btn').onclick = () => {
    if (playTimer) { window.clearInterval(playTimer); playTimer = 0; $('play-btn').textContent = '▶'; return; }
    $('play-btn').textContent = '⏸';
    playTimer = window.setInterval(() => {
      const y = store.get().year;
      const stepY = y < 0 ? 25 : 10;
      const next = y >= NOW ? MIN_YEAR : normalizeYear(y + stepY, NOW);
      store.set({ year: next });
    }, 400);
  };

  $<HTMLInputElement>('exag-m').oninput = (e) => store.set({ exaggeration: Number((e.target as HTMLInputElement).value) });
  $('korea-btn').onclick = () => { closeMenu(); fly(KOREA_CAM); };
  $('world-btn').onclick = () => { closeMenu(); fly(WORLD_CAM); };
  $('modern-btn').onclick = () => store.set({ modernBorders: !store.get().modernBorders });
  $<HTMLSelectElement>('light-sel').onchange = (e) => store.set({ lighting: (e.target as HTMLSelectElement).value as any });
  $<HTMLSelectElement>('layer-sel').onchange = (e) => {
    const layer = (e.target as HTMLSelectElement).value as LayerId;
    if (store.get().battle) closeBattle();
    store.set({ layer, playing: true });
    closeMenu();
    if (layer === 'monsoon') fly({ center: [100, 22], zoom: 2.6, pitch: 20 });
    if (layer === 'dust') fly({ center: [112, 40], zoom: 3.0, pitch: 25 });
    if (layer === 'temp') fly({ center: [115, 42], zoom: 2.5, pitch: 15 });
  };
  const input = $<HTMLInputElement>('search');
  input.addEventListener('input', () => { activeHit = 0; renderSearch(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && lastHits[activeHit]) goHit(lastHits[activeHit]);
    else if (e.key === 'ArrowDown') { activeHit = Math.min(lastHits.length - 1, activeHit + 1); renderSearch(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { activeHit = Math.max(0, activeHit - 1); renderSearch(); e.preventDefault(); }
    else if (e.key === 'Escape') $('search-results').hidden = true;
  });
  $('browse-btn').onclick = () => {
    const el = $('browse');
    el.hidden = !el.hidden;
    $('browse-btn').classList.toggle('on', !el.hidden);
    if (!el.hidden) { renderBrowse(); closeMenu(); }
  };
  $('menu-btn').onclick = () => {
    const open = !$('hud-tr').classList.contains('open');
    $('hud-tr').classList.toggle('open', open);
    $('menu-btn').setAttribute('aria-expanded', String(open));
  };

  for (const b of BATTLES) {
    const el = document.createElement('button');
    el.className = 'battle-marker';
    el.textContent = '⚔';
    el.title = `${b.title} (${b.year}년) 자세히 보기`;
    el.setAttribute('aria-label', el.title);
    el.onclick = (ev) => { ev.stopPropagation(); openBattle(b); };
    battleMarkers.set(b.id, new maplibregl.Marker({ element: el }).setLngLat([b.lon, b.lat]).addTo(map));
  }
}

store.subscribe((s, prev) => {
  if (!ready) return;
  if (s.year !== prev.year) { renderYear(s); void applyBorders(s.year); }
  if (s.modernBorders !== prev.modernBorders) {
    setLayerVisible(map, 'modern-line', s.modernBorders);
    $('modern-btn').setAttribute('aria-pressed', String(s.modernBorders));
    histLabels.setVisible(s.layer === 'geo' || s.modernBorders);
    updateHistLabels(s.year);
  }
  if (s.lighting !== prev.lighting) applyLighting(s);
  if (s.exaggeration !== prev.exaggeration) { map.setTerrain({ source: 'dem', exaggeration: s.exaggeration }); const v = document.getElementById('exag-v'); if (v) v.textContent = `${s.exaggeration}배`; $<HTMLInputElement>('exag-m').value = String(s.exaggeration); }
  if (s.layer !== prev.layer || s.monsoonMonth !== prev.monsoonMonth || s.tempMode !== prev.tempMode) {
    $<HTMLSelectElement>('layer-sel').value = s.layer;
    applyLayer(s, prev);
    updateBattleMarkers(s.year);
  } else if (s.tempThreshold !== prev.tempThreshold) applyLayer(s, prev);
  else if (s.playing !== prev.playing) { particles.setRunning(s.playing); const pb = document.getElementById('lp-play'); if (pb) pb.textContent = s.playing ? '⏸ 정지' : '▶ 재생'; }
});

async function boot(): Promise<void> {
  buildUi();
  tickClock();
  window.setInterval(tickClock, 15000);
  void loadWeather();
  window.setInterval(loadWeather, 10 * 60 * 1000);
  const loaded = new Promise<void>((r) => (map.loaded() ? r() : map.once('load', () => r())));
  const [, modern, labels, rivers, temp] = await Promise.all([
    data.init(),
    fetch('/data/modern-borders.json').then((r) => r.json()),
    fetch('/data/modern-labels.json').then((r) => r.json()),
    fetch('/data/rivers.json').then((r) => r.json()),
    fetch('/data/temperature.json').then((r) => r.json()),
    loaded,
  ]);
  tempGrid = temp;
  modernLabelItems = labels.features.map((f: any, i: number) => ({ id: `m-${i}`, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], text: f.properties.k, cls: 'modern', pri: -f.properties.r }));
  (map.getSource('modern') as any).setData(modern);
  (map.getSource('rivers') as any).setData(rivers);
  (map.getSource('jet') as any).setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[75, 40], [90, 41.5], [105, 41.8], [118, 40.5], [128, 38.8], [138, 38], [150, 38.5]] } }] });
  ready = true;
  document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  const s = store.get();
  renderYear(s);
  await applyBorders(s.year);
  applyLighting(s);
  applyLayer(s, null);
  $('loading').classList.add('done');
  window.setTimeout(() => fly(HISTORY_CAM, 3500), 300);
  document.body.dataset.ready = '1';
}

// Expose a small handle for automated tests.
(window as any).__he = { store, map, particles, histLabels, data };
boot().catch((e) => {
  console.error(e);
  $('loading').textContent = '불러오기에 실패했어요. 새로고침해 주세요.';
});
