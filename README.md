# 역사 지구본 (historyearth)

연도 막대를 움직이며 세계와 한반도의 나라 경계, 그리고 계절풍·황사·기온 같은 기후를 3D 지구본에서 살펴보는 **수업용 웹 앱**입니다.

- 라이브: https://historyearth.vercel.app
- 독자 구현: Threads @history_jongile 선생님의 데모 영상에서 **기능과 사용 흐름만 참고**해 새로 만들었습니다. 원작의 코드, 한국사 영토 데이터, 설명 문구, 이미지·아이콘은 쓰지 않았습니다. 설명 문구와 한국사 영역 다각형은 모두 이 저장소에서 직접 작성했습니다.

## 기능
- 처음 화면은 동아시아를 거의 위에서 내려다보는 지도 보기(끌어서 기울이면 3D)
- 3D 지구본: 역사 지도처럼 선명한 나라 색면(기복 음영이 비쳐 보임), 얇은 밝은 국경선+어두운 테두리, 파란 강, 도시·강·산맥 이름, 위성 영상, 대기 빛, 실제 고도 기반 3D 지형(과장 1~5배), 회전·확대·기울이기
- 좌상단: 연도(기원전/서기), 한국사 시대 배지, 서울 현재 시각·날씨(Open-Meteo)
- 옛날 찾기(장소·사건·전투·그 해의 나라 이름 검색), 검색 보기(목록), 지금 나라(현대 국경 + 나라 이름)
- 한반도로 / 지구 전체 비행, 조명(낮·지금 낮밤·밤), 레이어(지리·역사 / 몬순 / 황사 / 기온)
- 시대 버튼 16개(고조선~오늘날) → 연도 설정 + 카메라 이동
- 기원전 3000년~현재 연도 막대(자동 재생 버튼 포함): 국경 색면·라벨 갱신, 수렵채집민 같은 비국가 집단 라벨
- 몬순: 7월/1월, 재생/정지, 바람 입자, 히말라야·장마 전선 구름과 비, 지형성 강우 단면 그림, 큰 강 강조
- 황사: 고비·타클라마칸에서 출발한 먼지 입자가 편서풍을 타고 한반도·일본으로, 제트 기류 표시, 황사 vs 미세먼지 표
- 기온: 1월/7월/연교차, -30~30°C 범례와 "찾을 기온" 막대, 지도 색칠, 시베리아 고기압 북서풍 입자
- 전투 상세: 황산벌(660, 3D 지형 확대·진영·현재 지명), 한산도 대첩(1592, 견내량 유인 → 학익진 포위 애니메이션)
- 아주 먼 옛날(지구 탄생~농사의 시작) 설명 모드(글 위주)

## 실행
```bash
npm install
npm run dev          # 개발 서버
npm test             # Vitest 단위 테스트
npm run build        # dist/ 정적 빌드
npx playwright test  # 브라우저 테스트(빌드 후, docs/screenshots에 화면 저장)
# 데이터 다시 만들기
bash scripts/fetch-raw.sh && npm run data
node scripts/fetch-temperature.mjs   # 기온 격자(Open-Meteo, 키 불필요)
```
API 키나 계정이 필요 없습니다(`.env.example` 비어 있음).

## 데이터·이미지 출처와 라이선스
| 무엇 | 출처 | 라이선스 |
|---|---|---|
| 세계 역사 국경(BC 3000~2010, 46개 시점 + 1368년 보정 시점) | [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) – 공유 경계선(TopoJSON 호) 위에서 모서리를 둥글게 다듬고 촘촘히 한 뒤, Natural Earth 10m 현대 국경선·강과 겹치는 구간은 그 선에 맞추고(`scripts/refine-borders.mjs`), 10m 육지로 잘라 해안까지 채워(`scripts/fill-coast-gaps.mjs`) `public/data/borders/`에 포함. 몇몇 나라 이름은 시대에 맞게 고침 | GPL-3.0 (해당 데이터 파일은 GPL-3.0을 따름) |
| 한반도 나라 영역(고조선~현재, 53개 구간) | 이 저장소에서 직접 작성(`scripts/korea-polygons.mjs`). 한강·소백산맥·낙동강·대동강–원산만·천리장성 같은 공유 경계선으로 그려 이웃 나라 사이 틈·겹침이 없고, Natural Earth 10m 육지로 잘라 냄 | CC BY 4.0 (이 저장소) |
| 1368~1499년 명·북원·여진 영역 | 이 저장소에서 직접 작성(`scripts/ming-1400.mjs`): 원본 1400년 시점의 원 다각형을 명 초기 북쪽 경계(가욕관–오르도스–대동·선부–개평·대녕–요동 변장–압록강)와 대흥안령 선으로 나눔 | CC BY 4.0 (이 저장소) |
| 나라 이름 한글 표기 | 직접 만든 대응표(`scripts/name-ko-table.txt`, 국립국어원 외래어 표기·교과서 표기 기준) + 규칙(`scripts/name-ko.mjs`, `scripts/translit-ko.mjs`) | CC BY 4.0 (이 저장소) |
| 현대 국경·나라 이름 | [Natural Earth](https://www.naturalearthdata.com/) 1:10m admin-0 boundary lines(국경선·국경 맞추기 기준), 1:110m countries(이름) | 퍼블릭 도메인 |
| 육지 경계(해안선 자르기)·강 | [Natural Earth](https://www.naturalearthdata.com/) 1:10m land, rivers + lake centerlines | 퍼블릭 도메인 |
| 기본 지구 영상(줌 8 이하) | [NASA Blue Marble](https://earthobservatory.nasa.gov/features/BlueMarble) Shaded Relief + Bathymetry, [NASA GIBS](https://earthdata.nasa.gov/gibs) 타일 | 퍼블릭 도메인(NASA) |
| 확대 위성 영상(줌 7 이상) | [Sentinel-2 cloudless 2016 by EOX](https://s2maps.eu) (Copernicus Sentinel data 2016) | CC BY 4.0 |
| 고도(3D 지형·음영 기복) | [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium; SRTM, GMTED2010, ETOPO1 등) | 출처별 공개 라이선스, [속성 표기](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) |
| 기온 격자(1월·7월) | [Open-Meteo Historical Weather API](https://open-meteo.com/) – ERA5 재분석, 2024년 월평균, 6° 간격 | CC BY 4.0 (Open-Meteo / Copernicus ERA5) |
| 서울 실시간 날씨 | [Open-Meteo Forecast API](https://open-meteo.com/) | CC BY 4.0 |
| 바람·먼지 흐름 | 교과서 수준 패턴을 직접 단순화한 함수(`src/climate/winds.ts`). 관측값 아님 | 이 저장소 |
| 지도 엔진 | [MapLibre GL JS](https://maplibre.org/) v5 (globe + terrain) | BSD-3-Clause |

모든 설명 문구, 전투 장면 배치, 아이콘(유니코드 기호와 SVG)은 이 앱을 위해 새로 썼습니다.

## 한계
- 세계 국경은 historical-basemaps 시점(수십~수백 년 간격) 중 가장 가까운 이전 시점을 씁니다.
- 바람·먼지·구름 애니메이션은 설명용 그림입니다. 기온은 6° 격자를 보간해 산맥 같은 작은 지형은 드러나지 않습니다.
- 아주 먼 옛날 모드는 글 설명만 있고, 그 시대의 대륙 지도는 없습니다.
