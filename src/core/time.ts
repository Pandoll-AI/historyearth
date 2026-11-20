// Year handling. Years are historical: negative = BC, there is no year 0.
export const MIN_YEAR = -3000;
export const currentYear = (now: Date = new Date()): number => now.getFullYear();

export function normalizeYear(y: number, max = currentYear()): number {
  let v = Math.round(y);
  if (v === 0) v = 1;
  return Math.min(max, Math.max(MIN_YEAR, v));
}

/** Slider value uses astronomical numbering (0 = 1 BC) so the range is continuous. */
export const yearToSlider = (y: number): number => (y < 0 ? y + 1 : y);
export const sliderToYear = (v: number): number => (v <= 0 ? v - 1 : v);

export function formatYear(y: number): string {
  return y < 0 ? `기원전 ${-y}년` : `${y}년`;
}

export interface KoreanEra { name: string; detail: string }

const ERAS: Array<[number, number, string, string]> = [
  [-99999, -2334, '선사 시대', '신석기 문화, 아직 나라가 없던 때'],
  [-2333, -109, '고조선', '우리 역사 첫 나라(건국 연도는 전승)'],
  [-108, -58, '여러 나라 시대', '부여·고구려·옥저·동예·삼한'],
  [-57, 667, '삼국 시대', '고구려·백제·신라와 가야'],
  [668, 697, '통일신라', '신라가 삼국을 통일한 뒤'],
  [698, 899, '남북국 시대', '남쪽의 통일신라, 북쪽의 발해'],
  [900, 935, '후삼국 시대', '후백제·후고구려·신라'],
  [936, 1269, '고려 시대', '고려가 후삼국을 다시 통일'],
  [1270, 1355, '고려(원 간섭기)', '몽골 원나라의 간섭을 받던 때'],
  [1356, 1391, '고려 후기', '공민왕의 개혁과 고려의 마지막'],
  [1392, 1591, '조선 전기', '한양 도읍, 훈민정음 창제'],
  [1592, 1862, '조선 후기', '임진왜란 이후의 조선'],
  [1863, 1896, '조선 말·개항기', '문호 개방과 근대화의 시작'],
  [1897, 1909, '대한제국', '황제의 나라를 선포'],
  [1910, 1944, '일제 강점기', '일본의 식민 지배'],
  [1945, 1947, '광복과 군정기', '광복, 남북에 미군·소련군 주둔'],
  [1948, 99999, '대한민국', '남과 북으로 나뉜 한반도'],
];

export function koreanEra(y: number): KoreanEra {
  for (const [a, b, name, detail] of ERAS) if (y >= a && y <= b) return { name, detail };
  return { name: '알 수 없음', detail: '' };
}

/** Pick the latest snapshot year that is <= year (or the earliest one). */
export function snapshotFor(year: number, years: number[]): number {
  let best = years[0];
  for (const s of years) if (s <= year) best = s;
  return best;
}
