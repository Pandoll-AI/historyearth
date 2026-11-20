# 진행 상황 (KST/SGT 기준, UTC+8)

- 11-20 21:00 시작: 명세·선호 확인, Vercel 이름(historyearth) 비어 있음 확인, 프로젝트 생성
- 11-20 21:08 데이터 준비 완료: 역사 국경 46개 시점(BC3000~2010), 한국사 영역 55개 구간(직접 작성), 현대 국경·강, 1월/7월 기온 격자(ERA5)
- 11-20 21:18 지구본 첫 화면 동작: 위성 영상·3D 지형·475년 국경·한국사 영역·서울 시각/날씨 docs/screenshots/progress/2118-globe.png
- 11-20 21:19 몬순 레이어 동작: 7월 바람 입자·강 강조·지형성 강우 단면 그림 docs/screenshots/progress/2119-monsoon.png
- 11-20 21:21 기온 레이어 동작: 1월 기온 지도(ERA5)·범례·시베리아 바람 docs/screenshots/progress/2121-temperature.png
- 11-20 21:22 전투 상세 동작: 한산도 대첩 학익진 애니메이션 docs/screenshots/progress/2122-battle-hansando.png
- 11-20 21:25 전투 상세 동작: 황산벌 전투(3D 지형 확대) docs/screenshots/progress/2125-battle-hwangsanbeol.png
- 11-20 21:26 휴대폰 세로 화면 확인 docs/screenshots/progress/2126-mobile.png
- 11-20 21:29 한반도로 비행·라벨 겹침/뒷면 라벨 수정 docs/screenshots/progress/2129-korea-475.png
- 11-20 21:30 단위 테스트 31개 통과(Vitest)
- 11-20 22:04 황사 레이어 완성: 먼지가 편서풍을 타고 한반도·일본으로, 입자 미리 퍼뜨리기 docs/screenshots/progress/2203-dust.png
- 11-20 22:12 연도 막대 동작 확인(1450년 조선, 한반도로 비행) docs/screenshots/progress/2212-timeline-1450.png
- 11-20 22:12 휴대폰 세로·가로 화면 확인(메뉴 접기, 시대 버튼) docs/screenshots/progress/2212-mobile-era.png
- 11-20 22:12 테스트 통과: Vitest 32/32, Playwright 9/9(1건은 타일 오류 로그로 재시도 → 지도 타일 오류를 경고로 처리하고 재확인 통과)
- 11-20 22:29 지도 품질 개선 전 화면 기록(475·700·1450·2026, 동아시아) docs/screenshots/progress/2229-map-quality-before-475.png, 2229-map-quality-before-700.png, 2229-map-quality-before-1450.png, 2229-map-quality-before-2026.png
- 11-20 22:42 지도 품질 개선: 10m 해안선 자르기, 한반도 경계 다시 그림(강·산맥 기준), Blue Marble+음영 기복, 진한 색면·이중 국경선·파란 강·도시/강 라벨, 위에서 보는 기본 카메라 docs/screenshots/progress/2242-map-quality-after-475.png, 2242-map-quality-after-700.png, 2242-map-quality-after-1450.png, 2242-map-quality-after-2026.png, 2242-map-quality-after-korea-475.png
- 11-20 22:55 개선 후 테스트 통과: Vitest 32/32, Playwright 8/8(데스크톱 6, 모바일 2)
