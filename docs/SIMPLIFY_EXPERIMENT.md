# 해안선·국경 단순화 실험 (2026-11-21)

목적: 해안선이 지나치게 촘촘해 무겁다는 지적에 따라, 단순화 방법과 정도를 바꿔 가며 크기·속도·오차를 재고 규칙으로 하나를 고른다.

## 방법
- 대상: Natural Earth 10m 육지(해안선 자르기 마스크)와 그 마스크로 자른 1400년(동아시아)·1600년(유럽, 다각형 가장 많음) 시점. 국경은 모두 같은 공유 경계선 정리(`scripts/refine-borders.mjs`)를 거친 뒤 각 방법으로 단순화했다.
- 알고리즘: mapshaper `-simplify`의 Douglas-Peucker(`dp`), Visvalingam-Whyatt(`visvalingam`), 가중 Visvalingam(기본값), 비율 유지(`3%`). 모두 공유 호(arc) 위에서 단순화하는 위상 보존 방식이며 `keep-shapes`를 켰다.
- 오차: 원본 10m 해안선 꼭짓점 ↔ 단순화 해안선 사이 거리(양방향, km). 영역별 p95·p99(작은 섬이 통째로 빠지는 경우가 최댓값을 지배해 하우스도르프 최댓값 대신 분위수로 비교). 30km² 미만 섬은 양쪽 모두 뺐다.
- 위상: 겹침 = 각 다각형 넓이 합 − 녹인 전체 넓이(km²). 0이면 겹침 없음. 틈은 `mapshaper -clean`이 막는다.
- 브라우저: 박스의 headless Chromium + SwiftShader(소프트웨어 GL, GPU 없음). `setData` 후 지도 `idle`까지 시간(=geojson-vt 타일 분할+그리기), 6초 동안 카메라를 옮기며 잰 FPS. 스크립트: `scripts/simplify-experiment.mjs`, `e2e/simplify-fps.spec.ts`. 원자료: `docs/simplify-metrics.json`, `docs/simplify-fps.json`.

## 결과
| 방법 | 육지 꼭짓점 | 꼭짓점 1400 / 1600 | gzip KB 1400 / 1600 | 파싱 ms | 불러오기→idle s | FPS | 오차 동아시아 p95·p99 km | 유럽 p95·p99 | 한반도 p95·p99 | 겹침 km² | 규칙 | 화면 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 기존(가중 VW, 육지 1.5km·최종 0.4km) | 114,997 | 67,260 / 116,733 | 359 / 627 | 5.4 / 10.4 | 18.2 / 9.0 | 2.3 / 2.3 | 3.91 · 10.89 | 3.58 · 12.37 | 5.79 · 14.11 | 0 / 0 | — | [동아시아](screenshots/progress/0004-simplify-base-eastasia.png) · [한반도](screenshots/progress/0004-simplify-base-korea.png) |
| Douglas-Peucker 1km | 131,704 | 53,256 / 66,723 | 288 / 373 | 4.3 / 6.7 | 3.9 / 1.3 | 2.5 / 2.6 | 0.78 · 0.97 | 0.78 · 0.97 | 0.82 · 12.63 | 0 / 0 | 통과 | [동아시아](screenshots/progress/0004-simplify-dp-1k-eastasia.png) · [한반도](screenshots/progress/0004-simplify-dp-1k-korea.png) |
| Douglas-Peucker 2.5km | 67,627 | 30,071 / 38,925 | 172 / 230 | 2.8 / 4.3 | 3.0 / 3.0 | 2.5 / 2.5 | 2.05 · 11.64 | 1.9 · 6.56 | 5 · 22.03 | 0 / 0 | — | [동아시아](screenshots/progress/0004-simplify-dp-2.5k-eastasia.png) · [한반도](screenshots/progress/0004-simplify-dp-2.5k-korea.png) |
| Douglas-Peucker 5km | 38,156 | 17,657 / 24,418 | 106 / 153 | 1.5 / 3.4 | 2.7 / 1.6 | 2.6 / 2.6 | 4.56 · 20.01 | 4.05 · 14.95 | 10.8 · 26.02 | 0 / 0 | — | [동아시아](screenshots/progress/0004-simplify-dp-5k-eastasia.png) · [한반도](screenshots/progress/0004-simplify-dp-5k-korea.png) |
| Visvalingam-Whyatt 1km | 158,368 | 65,440 / 89,190 | 351 / 491 | 6.1 / 8.2 | 2.8 / 1.3 | 2.4 / 2.6 | 0.81 · 2.08 | 0.83 · 1.85 | 0.85 · 9.51 | 0 / 0 | 통과 | [동아시아](screenshots/progress/0004-simplify-vw-1k-eastasia.png) · [한반도](screenshots/progress/0004-simplify-vw-1k-korea.png) |
| Visvalingam-Whyatt 2.5km | 64,343 | 31,700 / 45,618 | 182 / 268 | 2.8 / 4.3 | 2.8 / 1.2 | 2.5 / 1.9 | 5.51 · 21.34 | 4.46 · 16.51 | 11.42 · 26.06 | 0 / 0 | — | [동아시아](screenshots/progress/0004-simplify-vw-2.5k-eastasia.png) · [한반도](screenshots/progress/0004-simplify-vw-2.5k-korea.png) |
| Visvalingam-Whyatt 5km | 28,633 | 16,758 / 26,381 | 101 / 164 | 1.5 / 2.8 | 1.1 / 1.8 | 2.1 / 2.4 | 15.18 · 51.77 | 14.75 · 35.21 | 16.43 · 29.57 | 0 / 0 | — | [동아시아](screenshots/progress/0004-simplify-vw-5k-eastasia.png) · [한반도](screenshots/progress/0004-simplify-vw-5k-korea.png) |
| 가중 VW 2.5km | 64,315 | 32,200 / 48,983 | 184 / 285 | 2.8 / 4.4 | 3.5 / 1.5 | 2.1 / 1.5 | 9.35 · 27.15 | 9.62 · 25.23 | 14.98 · 26.14 | 0 / 0 | — | [동아시아](screenshots/progress/0004-simplify-wvw-2.5k-eastasia.png) · [한반도](screenshots/progress/0004-simplify-wvw-2.5k-korea.png) |
| 가중 VW 5km | 27,050 | 18,004 / 29,214 | 108 / 180 | 1.5 / 3.1 | 2.5 / 1.2 | 2.3 / 2.5 | 24.63 · 91.63 | 22.31 · 54.2 | 25.18 · 36.65 | 0 / 0 | — | [동아시아](screenshots/progress/0004-simplify-wvw-5k-eastasia.png) · [한반도](screenshots/progress/0004-simplify-wvw-5k-korea.png) |
| 가중 VW 3% 유지 | 13,843 | 22,285 / 39,827 | 130 / 235 | 2 / 4.4 | 3.9 / 1.4 | 2.2 / 2.5 | 62.15 · 999 | 47.93 · 100.52 | 33.64 · 89.85 | 0 / 0 | — | [동아시아](screenshots/progress/0004-simplify-wvw-3%-eastasia.png) · [한반도](screenshots/progress/0004-simplify-wvw-3%-korea.png) |

화면 캡처는 해안선 비교용이라 색면 없이 경계선만 보인다(실험 파일에는 색 속성이 없음).

## 읽기
- FPS는 모든 방법에서 1.5~2.6으로 차이가 잡히지 않는다. 박스는 GPU가 없어 지구본·지형(DEM) 그리기가 시간을 거의 다 쓰므로 국경 꼭짓점 수는 FPS를 가르지 못한다. 실제 차이는 파일 크기·파싱·타일 분할(불러오기→idle)에서 난다.
- MapLibre의 GeoJSON 소스는 이미 확대 단계별로 geojson-vt가 다시 단순화(LOD)한다. 그래서 낮은 확대에서 그리는 꼭짓점은 원본보다 훨씬 적고, 원본 정밀도는 확대했을 때만 드러난다. 벡터 타일(PMTiles 등)로 바꾸면 47개 시점마다 타일 묶음을 만들어야 하는데, 위 측정상 그리기 속도 이득이 없어 이번엔 쓰지 않는다.
- 같은 간격에서 DP가 VW보다 오차 분위수(p99)가 작다. DP는 간격을 최대 허용 오차로 지키고, VW는 넓이 기준이라 길고 얕은 만·곶을 더 많이 깎는다.

## 고른 값과 규칙
규칙: **동아시아·유럽 해안 오차 p95 ≤ 1km 그리고 p99 ≤ 2.5km(확대 4에서 화면 1px ≈ 5km의 절반 이하)를 지키는 것 중 gzip 크기가 가장 작은 것.** FPS는 측정 오차 안에서 같아 기준에서 뺐다.

→ **Douglas-Peucker 1km** (육지 마스크·최종 단순화 모두). 기존 대비 1600년 파일 627→373KB(gzip, −40%), 꼭짓점 116,733→66,723, 불러오기→idle 9.0→1.3s, 동아시아 오차 p95 3.9→0.8km. 겹침 0 유지. 한반도 오차 p99가 큰 것은 다도해 작은 섬 때문이며, 한반도는 자체 영역 층이 덮는다.

## 표의 "999"(최댓값)에 대해
최댓값 999는 "200km 안에 짝이 되는 해안선이 없음"을 뜻한다. 동아시아 상자 안 기준 해안 고리 150개 중 기존 설정에서 26개가 단순화 뒤 30km² 아래로 줄어 섬 거르기에서 통째로 빠졌고(먼바다 작은 섬), 그 꼭짓점이 최댓값을 만든다. 중국 동해안 색면 빈틈과는 다른 문제다. 그 빈틈은 원본 다각형의 해안선이 실제 해안보다 안쪽에 있어서 생겼고, `scripts/fill-coast-gaps.mjs`(해안 쪽 빈 육지를 붙어 있는 나라에 붙임)로 고쳤다. `tests/coverage.test.ts`가 475·700·1450·2026년에 상하이·항저우·칭다오·푸저우 등 12곳이 어떤 나라 안에 드는지 확인한다.

## 적용 후(실제 빌드, 해안 채우기 포함)
| | 이전 배포(e936453) | 이번 빌드 |
|---|---|---|
| 1400년 파일 gzip | 163KB | 486KB |
| 1600년 파일 gzip / 꼭짓점 | 310KB / 62,411 | 573KB / 100,887 |
| 국경 시점 전체 | 32MB(47개 미만) | 73MB(47개) |
| 첫 화면 준비(로컬, SwiftShader) | 약 13.9s | 11.5s |
| FPS(정지, SwiftShader) | 약 2 | 2.2 |

이전 배포보다 파일이 커진 이유는 단순화가 아니라 (1) 국경을 매끄럽게·촘촘하게 하고 10m 국경·강에 맞춘 것, (2) 해안 빈틈을 실제 해안선까지 채운 것이다. 같은 정밀화 파이프라인 안에서는 DP 1km가 기존 설정보다 1600년 기준 −40%다. 한 시점 파일만 내려받으므로 첫 화면 준비 시간은 오히려 줄었다.
