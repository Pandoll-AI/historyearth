---
name: historyearth
title: 역사 지구본
status: 배포완료
priority: 보통
progress: 95
stack: Vite, TypeScript, MapLibre GL(globe+terrain), Vitest, Playwright
repo: 
deploy: https://historyearth.vercel.app
run: npm run dev
needs: Node 20+, Vercel(emergency-lee) 커넥터 배포
next: SJ가 Pandoll-AI/historyearth 빈 private 저장소 생성+Cursor GitHub App 접근 허용 후 푸시
created: 2026-11-20
updated: 2026-11-21
---

# historyearth — 역사 지구본

## 목표
- 수업용 웹 3D 역사 지구본. 연도 막대로 세계·한반도 국경을 바꾸고, 몬순·황사·기온 레이어와 전투 장면으로 지리·역사를 함께 보여 준다.
- 참고 영상(Threads @history_jongile)의 기능·흐름만 참고한 독자 구현. 명세: `/workspace/charlie/historyearth-spec.md`

## 실행 구조
| 단계 | 명령 | 비고 |
|---|---|---|
| 설치 | `npm install` | Node 20+ |
| 개발 실행 | `npm run dev` | Vite |
| 테스트 | `npm test` / `npx playwright test` | Vitest 32개, Playwright 13개(데스크톱 6, 화면 정렬 5, 모바일 2). `E2E_URL=https://historyearth.vercel.app`로 라이브 확인(`live_*` 스크린샷) |
| 빌드 | `npm run build` | `dist/` 정적 파일 |
| 데이터 | `bash scripts/fetch-raw.sh && npm run data` | `node scripts/fetch-temperature.mjs`(기온 격자) |
| 배포 | Vercel 커넥터 upload_file + create_deployment | 팀 emergency-lee, 프로젝트 historyearth |

구성 요소와 데이터 흐름:
- `src/main.ts` UI·상태 연결, `src/core/*` 연도·시대·검색·데이터 로더(순수 함수, 단위 테스트 대상)
- `src/map/*` MapLibre 지구본(위성·지형·대기), DOM 라벨, 입자 캔버스, 밤/기온 래스터, 전투 장면
- `public/data/` 시점별 국경(46개), 한국사 영역(korea.json), 현대 국경·강, 기온 격자

## 필요사항
- 환경변수: 없음
- 계정/연결: 없음(무키 공개 타일: NASA GIBS Blue Marble, EOX, AWS Terrain, Open-Meteo)
- 외부 의존성: 위 타일 서버의 가용성

## 다음 할 일
- [ ] SJ 실기기(태블릿·휴대폰)에서 FPS·터치 확인
- [ ] 필요하면 시대별 전투·사건 추가, 아주 먼 옛날 대륙 지도

## 이슈
- 박스에는 GPU가 없어 FPS는 소프트웨어 렌더링 값(2~5fps)만 측정됨

## 진행 로그
- 2026-11-20 프로젝트 생성
- 2026-11-20 지구본·타임라인·레이어 4종·전투 2곳·검색·모바일 구현, Vitest 32개 통과
- 2026-11-20 지도 품질 개선(10m 해안선, 한반도 경계 재작성, Blue Marble·음영, 라벨) + 8px 격자 정렬·정렬 검사 테스트. Vercel 운영 배포·라이브 검증 13/13. GitHub 푸시는 커넥터 저장소 생성 권한 부족으로 보류
- 2026-11-21 t7u 반영: 국경 정밀화(10m 국경·강 맞춤, 해안 채우기), 명·북원·여진 자체 영역, 한글 이름(라틴 0 테스트), 400ms 크로스페이드, 단순화 실험 DP 1km 선택, 운영 재배포 dpl_By1Z3LNnvkiWE8JhAeqRLGdeNpfG
- 2026-11-21 2026-11-21 최종 정리 커밋, 라이브 https://historyearth.vercel.app (dpl_By1Z3LNnvkiWE8JhAeqRLGdeNpfG)
- 2026-11-21 GitHub 푸시 실패: user-GitHub-xai 쓰기 403, 박스 gh 미로그인, 저장소는 현재 public. 설정은 변경하지 않음. origin만 추가.
