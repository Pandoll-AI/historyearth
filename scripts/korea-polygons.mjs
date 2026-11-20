// Hand-authored polygons of Korean polities (own work, CC BY 4.0 in this repo).
// Built from shared boundary lines (rivers, mountain ranges) so neighbouring states meet
// without gaps; shapes extend over the sea and are clipped to Natural Earth 10m land.
// Coordinates are [lon, lat]. Years: negative = BC. `from`/`to` inclusive.
// Lower `prio` wins where simultaneous shapes overlap.
// Extents follow textbook maps (public knowledge), drawn on shared river/ridge lines.

const rev = (a) => [...a].reverse();
const cat = (...parts) => parts.flat();
const upTo = (line, pt) => line.slice(0, line.findIndex((p) => p[0] === pt[0] && p[1] === pt[1]) + 1);
const from = (line, pt) => line.slice(line.findIndex((p) => p[0] === pt[0] && p[1] === pt[1]));

// --- shared lines ---------------------------------------------------------
// Yalu + Tumen rivers (west -> east)
const YALU_TUMEN = [[124.1, 39.75], [124.35, 39.88], [124.75, 40.2], [125.2, 40.5], [125.6, 40.72], [125.9, 40.9], [126.5, 41.35], [126.9, 41.75], [127.25, 41.55], [127.5, 41.45], [128.05, 41.45], [128.2, 41.95], [128.6, 42.05], [129.0, 42.2], [129.3, 42.4], [129.55, 42.45], [129.75, 42.7], [129.9, 42.95], [130.25, 42.9], [130.45, 42.6], [130.6, 42.4], [130.75, 42.25]];
// Sea closure around the peninsula (east -> south -> west), keeps Tsushima/Kyushu out
const SOUTH_SEA = [[132.0, 38.0], [132.0, 37.0], [129.7, 35.3], [129.2, 34.95], [128.7, 34.2], [127.5, 33.0], [126.0, 32.8], [124.0, 33.5], [123.8, 37.5]];
// Sobaek range from Jungnyeong pass south to the Seomjin river mouth
const JUKNYEONG = [128.43, 36.88], SONGNISAN = [127.87, 36.54], CHUPUNG = [128.0, 36.22];
const SOBAEK = [JUKNYEONG, [128.25, 36.83], [128.08, 36.78], [127.95, 36.65], SONGNISAN, [127.92, 36.38], CHUPUNG, [127.82, 36.0], [127.75, 35.86], [127.65, 35.6], [127.73, 35.34], [127.7, 35.15], [127.75, 34.95], [127.8, 34.3]];
// Nakdong river from Chupungnyeong side down to the mouth (north -> south)
const NAKDONG = [CHUPUNG, [128.28, 35.95], [128.45, 35.85], [128.42, 35.68], [128.45, 35.5], [128.62, 35.42], [128.83, 35.4], [128.95, 35.08], [129.0, 34.5]];
// Goguryeo southern limit around 475: Namyang bay - Jincheon - Chungju - Jungnyeong - Yeongil bay
const GOG_475 = [[125.8, 37.1], [126.75, 37.08], [127.05, 37.0], [127.43, 36.85], [127.7, 36.95], [127.93, 36.95], [128.2, 36.92], JUKNYEONG, [128.75, 36.8], [128.95, 36.6], [129.05, 36.4], [129.4, 36.05], [130.0, 36.0]];
// Goguryeo-Silla line after Silla took the Han river basin (553): Imjin river area to the east coast
const GOG_553 = [[125.9, 37.65], [126.15, 37.75], [126.45, 37.85], [126.7, 37.95], [126.95, 38.05], [127.1, 38.15], [127.6, 38.2], [128.0, 38.35], [128.3, 38.5], [128.6, 38.6], [129.2, 38.6]];
// Baekje-Silla line after 553 (Asan bay to Songnisan)
const BS_553 = [[125.8, 37.0], [126.8, 36.95], [127.0, 36.85], [127.2, 36.75], [127.45, 36.6], [127.6, 36.5], SONGNISAN];
// Baekje northern limit at its height (371): Hwanghae south - Imjin - upper Han river - Jungnyeong
const BK_371 = [[124.6, 38.0], [125.5, 38.2], [126.3, 38.3], [127.0, 38.3], [127.6, 38.0], [128.2, 37.6], [128.35, 37.2], JUKNYEONG];
// Unified Silla - Balhae line: Taedong river mouth to Wonsan bay
const TAEDONG_WONSAN = [[124.5, 38.55], [125.15, 38.7], [125.4, 38.85], [125.6, 38.95], [126.0, 39.1], [126.5, 39.15], [127.0, 39.2], [127.45, 39.15], [128.2, 39.0]];
// Goryeo Cheolli Jangseong (Yalu mouth - Doryeonpo)
const GORYEO_WALL = [[124.0, 39.7], [124.35, 39.85], [124.7, 40.0], [125.0, 40.05], [125.6, 40.1], [126.3, 39.95], [126.9, 39.85], [127.5, 39.75], [127.7, 39.75], [128.2, 39.6]];
const GORYEO_LATE = [[124.0, 39.7], [124.35, 39.88], [124.75, 40.2], [125.2, 40.5], [125.9, 40.9], [126.5, 41.0], [127.5, 41.0], [128.5, 41.1], [129.3, 40.95], [129.8, 40.7]];
const JOSEON_EARLY = [[124.0, 39.7], [124.35, 39.88], [124.75, 40.2], [125.2, 40.5], [125.9, 40.9], [126.5, 41.25], [127.3, 41.3], [128.3, 41.4], [129.2, 41.6], [129.7, 41.8], [130.2, 41.6]];
// Later Baekje northern/eastern edge (892-936)
const HUBAEKJE = [[125.8, 36.9], [126.8, 36.9], [127.1, 36.75], [127.4, 36.6], SONGNISAN, CHUPUNG, [128.2, 35.95], [128.3, 35.7], [128.25, 35.2], [128.2, 34.6]];
const LATE_SILLA_N = [CHUPUNG, [128.5, 36.55], [129.0, 36.6], [129.6, 36.6], [130.0, 36.6]];
// Liao river and Goguryeo's northern frontier around 475 (west -> east)
const LIAO_NORTH = [[121.8, 40.9], [122.4, 41.5], [123.0, 42.3], [123.6, 43.0], [124.5, 44.0], [125.3, 44.6], [126.4, 44.75], [127.5, 44.8], [128.5, 44.75], [129.5, 44.6], [130.4, 44.1], [131.0, 43.6]];
const EAST_SEA_N = [[131.0, 43.6], [131.3, 42.8], [131.5, 42.0], [131.5, 38.0]];
const WEST_SEA_GOG = [[124.3, 37.6], [122.5, 38.5], [121.0, 38.6], [120.8, 40.0], [121.8, 40.9]];

const PENINSULA_FULL = cat(YALU_TUMEN, [[131.2, 41.5]], SOUTH_SEA);
const southOf = (line, eastSea = [[132.0, 38.0]]) => cat(line, eastSea, SOUTH_SEA.slice(1));

export const KOREA = [
  { id: 'gojoseon-a', name: '고조선', from: -2333, to: -401, prio: 7, color: '#e08a3c',
    ring: [[120.5, 40.0], [121.0, 41.2], [121.5, 42.5], [122.5, 42.9], [123.5, 43.0], [124.5, 42.6], [125.5, 42.0], [125.9, 41.2], [126.0, 40.5], [125.8, 39.6], [125.8, 39.0], [125.0, 38.6], [123.0, 39.0], [121.0, 38.7]] },
  { id: 'gojoseon-b', name: '고조선', from: -400, to: -108, prio: 7, color: '#e08a3c',
    ring: [[121.5, 40.5], [122.0, 41.4], [122.5, 42.3], [123.5, 42.6], [124.5, 42.8], [125.5, 42.4], [126.5, 41.8], [127.0, 41.1], [127.3, 40.5], [127.3, 39.9], [127.2, 39.3], [126.8, 38.9], [126.4, 38.5], [125.0, 37.9], [124.5, 38.3], [123.5, 39.6], [122.3, 39.7]] },
  { id: 'buyeo', name: '부여', from: -200, to: 494, prio: 6, color: '#c9a24b',
    ring: [[123.2, 43.3], [124.0, 45.0], [125.0, 46.0], [127.0, 46.8], [129.0, 46.0], [129.5, 44.6], [128.5, 44.75], [127.5, 44.8], [126.4, 44.75], [125.3, 44.6], [124.5, 44.0], [123.6, 43.0]] },
  { id: 'nangnang', name: '낙랑군(한의 군현)', from: -108, to: 313, prio: 0, color: '#8d939e',
    ring: [[124.5, 38.3], [124.9, 39.2], [125.3, 39.8], [126.0, 39.75], [126.6, 39.6], [126.9, 39.1], [127.0, 38.6], [126.4, 37.9], [125.0, 37.8]] },
  { id: 'mahan', name: '마한', from: -100, to: 369, prio: 5, color: '#8cc265',
    ring: cat([[125.8, 37.9], [126.6, 37.75], [127.4, 37.6], [127.6, 37.0]], from(SOBAEK, SONGNISAN), [[126.6, 33.85], [125.5, 34.0], [124.5, 34.5], [124.5, 36.5]]) },
  { id: 'jinhan', name: '진한', from: -100, to: 300, prio: 5, color: '#d6c85a',
    ring: cat([[128.3, 37.0], [129.0, 37.0], [129.6, 37.0], [130.0, 36.0], [129.7, 35.4]], [[128.83, 35.4], [128.62, 35.42], [128.45, 35.5], [128.42, 35.68], [128.45, 35.85], [128.28, 35.95], CHUPUNG, [128.1, 36.5]]) },
  { id: 'byeonhan', name: '변한', from: -100, to: 41, prio: 5, color: '#7fc9a8',
    ring: cat(from(SOBAEK, CHUPUNG), [[128.5, 34.3]], rev(NAKDONG)) },
  { id: 'goguryeo-1', name: '고구려', from: -37, to: 199, prio: 4, color: '#e0544a',
    ring: [[124.3, 40.3], [124.4, 41.0], [124.6, 41.8], [125.3, 42.3], [126.0, 42.5], [126.8, 42.3], [127.5, 42.0], [127.8, 41.5], [127.8, 41.0], [127.2, 40.6], [126.5, 40.3], [125.8, 40.0], [125.2, 39.9]] },
  { id: 'goguryeo-2', name: '고구려', from: 200, to: 399, prio: 4, color: '#e0544a',
    ring: cat([[121.8, 40.9], [122.4, 41.5], [123.0, 42.3], [123.6, 42.9], [125.0, 43.4], [126.5, 43.6], [128.0, 43.2], [129.3, 42.8], [130.75, 42.25]], [[131.2, 41.5], [131.0, 38.6], [129.5, 37.9], [128.8, 37.9]], rev(BK_371).slice(5), [[124.3, 37.6], [122.5, 38.5], [121.0, 38.6], [120.8, 40.0]]) },
  { id: 'goguryeo-3', name: '고구려', from: 400, to: 552, prio: 4, color: '#e0544a',
    ring: cat(rev(GOG_475), WEST_SEA_GOG, LIAO_NORTH, EAST_SEA_N) },
  { id: 'goguryeo-4', name: '고구려', from: 553, to: 668, prio: 4, color: '#e0544a',
    ring: cat(rev(GOG_553), [[125.0, 37.6]], WEST_SEA_GOG, LIAO_NORTH, EAST_SEA_N, [[130.5, 38.6]]) },
  { id: 'baekje-1', name: '백제', from: -18, to: 249, prio: 1, color: '#4f86e0',
    ring: [[126.5, 37.3], [126.55, 37.6], [126.7, 37.8], [127.0, 37.82], [127.3, 37.75], [127.5, 37.5], [127.45, 37.25], [127.0, 37.1]] },
  { id: 'baekje-2', name: '백제', from: 250, to: 474, prio: 1, color: '#4f86e0',
    ring: cat(BK_371, SOBAEK.slice(1), [[126.6, 33.85], [125.5, 34.0], [124.5, 34.5], [124.3, 36.5], [124.3, 37.6]]) },
  { id: 'baekje-3', name: '백제', from: 475, to: 552, prio: 1, color: '#4f86e0',
    ring: cat(upTo(GOG_475, JUKNYEONG), SOBAEK.slice(1), [[126.6, 33.85], [125.5, 34.0], [124.5, 34.5], [124.5, 36.5]]) },
  { id: 'baekje-4', name: '백제', from: 553, to: 660, prio: 1, color: '#4f86e0',
    ring: cat(BS_553, from(SOBAEK, SONGNISAN).slice(1), [[126.6, 33.85], [125.5, 34.0], [124.5, 34.5], [124.5, 36.5]]) },
  { id: 'silla-1', name: '신라', from: -57, to: 399, prio: 2, color: '#f2c230',
    ring: [[128.6, 36.4], [129.1, 36.5], [129.6, 36.4], [130.0, 36.0], [129.7, 35.4], [129.2, 35.45], [128.8, 35.6]] },
  { id: 'silla-2', name: '신라', from: 400, to: 552, prio: 2, color: '#f2c230',
    ring: cat(from(GOG_475, JUKNYEONG), [[129.7, 35.3], [129.3, 34.7]], rev(NAKDONG), rev(upTo(SOBAEK, CHUPUNG)).slice(1)) },
  { id: 'silla-3a', name: '신라', from: 553, to: 561, prio: 2, color: '#f2c230',
    ring: cat(GOG_553, [[130.0, 37.0], [129.7, 35.3], [129.3, 34.7]], rev(NAKDONG), [[127.92, 36.38]], rev(BS_553), [[125.6, 37.4]]) },
  { id: 'silla-3b', name: '신라', from: 562, to: 675, prio: 2, color: '#f2c230',
    ring: cat(GOG_553, [[130.0, 37.0], [129.7, 35.3], [129.2, 34.95], [128.7, 34.2]], rev(from(SOBAEK, SONGNISAN)), rev(BS_553).slice(1), [[125.6, 37.4]]) },
  { id: 'gaya', name: '가야', from: 42, to: 561, prio: 3, color: '#62bfa5',
    ring: cat(from(SOBAEK, CHUPUNG), [[128.5, 34.3]], rev(NAKDONG)) },
  { id: 'unified-silla', name: '통일신라', from: 676, to: 891, prio: 2, color: '#f2c230',
    ring: southOf(TAEDONG_WONSAN) },
  { id: 'balhae', name: '발해', from: 698, to: 926, prio: 3, color: '#9b6be0',
    ring: cat(rev(TAEDONG_WONSAN), [[124.0, 39.7], [124.35, 39.88], [124.0, 40.5], [123.5, 41.5], [123.8, 43.0], [124.5, 45.5], [127.0, 47.0], [130.0, 47.5], [133.5, 47.0], [135.5, 44.5], [133.0, 42.8], [131.5, 42.5], [131.5, 40.0]]) },
  { id: 'late-silla', name: '신라(후삼국)', from: 892, to: 935, prio: 2, color: '#f2c230',
    ring: cat(LATE_SILLA_N, [[129.7, 35.3], [129.2, 34.95], [128.7, 34.2]], rev(HUBAEKJE).slice(0, 4)) },
  { id: 'hubaekje', name: '후백제', from: 892, to: 936, prio: 1, color: '#4f86e0',
    ring: cat(HUBAEKJE, [[127.5, 33.0], [126.0, 32.8], [124.0, 33.5], [124.5, 36.5]]) },
  { id: 'hugoguryeo', name: '후고구려(태봉)', from: 901, to: 917, prio: 3, color: '#e0544a',
    ring: cat(TAEDONG_WONSAN, [[130.0, 37.5], [130.0, 36.6]], rev(LATE_SILLA_N).slice(1), rev(HUBAEKJE).slice(-6), [[124.5, 37.3]]) },
  { id: 'goryeo-0', name: '고려', from: 918, to: 935, prio: 3, color: '#3fb08f',
    ring: cat(TAEDONG_WONSAN, [[130.0, 37.5], [130.0, 36.6]], rev(LATE_SILLA_N).slice(1), rev(HUBAEKJE).slice(-6), [[124.5, 37.3]]) },
  { id: 'goryeo-1', name: '고려', from: 936, to: 1355, prio: 3, color: '#3fb08f', ring: southOf(GORYEO_WALL) },
  { id: 'ssangseong', name: '쌍성총관부(원)', from: 1258, to: 1356, prio: 0, color: '#8d939e',
    ring: [[126.8, 39.0], [127.0, 39.3], [127.3, 39.6], [127.5, 40.1], [127.7, 40.6], [128.3, 40.7], [128.8, 40.6], [129.3, 40.3], [128.8, 39.8], [127.8, 39.5], [127.45, 39.15]] },
  { id: 'dongnyeong', name: '동녕부(원)', from: 1270, to: 1290, prio: 0, color: '#8d939e',
    ring: [[124.3, 38.6], [124.4, 39.4], [124.6, 40.0], [125.6, 40.1], [126.6, 40.0], [126.7, 39.6], [126.7, 39.2], [126.3, 38.9], [125.9, 38.6]] },
  { id: 'goryeo-2', name: '고려', from: 1356, to: 1391, prio: 3, color: '#3fb08f', ring: southOf(GORYEO_LATE, [[130.5, 40.0], [132.0, 38.0]]) },
  { id: 'joseon-1', name: '조선', from: 1392, to: 1449, prio: 3, color: '#e05f86', ring: southOf(JOSEON_EARLY, [[131.0, 41.0], [132.0, 38.0]]) },
  { id: 'joseon-2', name: '조선', from: 1450, to: 1896, prio: 3, color: '#e05f86', ring: PENINSULA_FULL },
  { id: 'korean-empire', name: '대한제국', from: 1897, to: 1909, prio: 3, color: '#e05f86', ring: PENINSULA_FULL },
  { id: 'colonial', name: '일제 강점기(일본 식민 지배)', from: 1910, to: 1944, prio: 3, color: '#a68790', ring: PENINSULA_FULL },
  { id: 'south-mil', name: '남한(미군정)', from: 1945, to: 1947, prio: 3, color: '#5b9fe0', ring: PENINSULA_FULL, clip: 'south38' },
  { id: 'north-mil', name: '북한(소련군정)', from: 1945, to: 1947, prio: 3, color: '#e0605a', ring: PENINSULA_FULL, clip: 'north38' },
  { id: 'rok-1', name: '대한민국', from: 1948, to: 1952, prio: 3, color: '#5b9fe0', ring: PENINSULA_FULL, clip: 'south38' },
  { id: 'dprk-1', name: '조선민주주의인민공화국(북한)', from: 1948, to: 1952, prio: 3, color: '#e0605a', ring: PENINSULA_FULL, clip: 'north38' },
  { id: 'rok-2', name: '대한민국', from: 1953, to: 9999, prio: 3, color: '#5b9fe0', ring: PENINSULA_FULL, clip: 'southDmz' },
  { id: 'dprk-2', name: '조선민주주의인민공화국(북한)', from: 1953, to: 9999, prio: 3, color: '#e0605a', ring: PENINSULA_FULL, clip: 'northDmz' },
];
// Drop repeated points and an explicit closing point so rings are clean.
for (const k of KOREA) {
  const r = k.ring.filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  while (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
  k.ring = r;
}
// Split lines across the peninsula (west -> east).
export const LINE_38 = [[123.5, 38.0], [131.0, 38.0]];
export const LINE_DMZ = [[123.5, 37.68], [126.1, 37.72], [126.45, 37.85], [126.7, 37.95], [126.95, 38.1], [127.1, 38.3], [127.5, 38.32], [128.0, 38.3], [128.35, 38.62], [131.0, 38.62]];
