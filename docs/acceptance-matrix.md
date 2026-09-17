# Stock2 MVP 수용 조건 추적표

- 검증일: 2026-09-17 (Asia/Seoul)
- 환경: Windows, Node.js 24.19.0, pnpm 11.19.0, Chrome/Playwright
- 범위: PDD v0.2.9의 AC-01~AC-29
- 판정 원칙: 자동 테스트, 실공급원 측정 또는 명시된 후속 경계 중 하나 이상의 재현 가능한 증거가 있어야 통과로 판정한다.

| ID    | 판정           | 핵심 증거                                                                                     |
| ----- | -------------- | --------------------------------------------------------------------------------------------- |
| AC-01 | 통과           | `adapter.test.ts`의 고정 Yahoo 시계열 fixture와 `smoke.spec.ts` 시장 탐색 흐름                |
| AC-02 | 통과           | `observed-gaps.test.ts`, `market-chart.tsx`의 공백 범위·무보간·관측값 한정 영향 안내          |
| AC-03 | 통과           | `analysis-start.test.ts`의 상장 전 0원 금지 및 실제 공통 시작일 검증                          |
| AC-04 | 통과           | `historical-value.test.ts`, 포트폴리오 E2E의 현재 수량 기준 과거 추정 가치                    |
| AC-05 | 통과           | `analysis-start.test.ts`의 실행 한정 제외·원본 불변 검증                                      |
| AC-06 | 통과           | `recommended-portfolios.test.ts`, `performance.test.ts`, 추천 E2E                             |
| AC-07 | 통과           | 추천 E2E의 새 포트폴리오 복사와 덮어쓰기 취소 시 기존 데이터 보존                             |
| AC-08 | 통과           | 수집 엔진의 마지막 정상값 표시 보존/실패 payload 분리와 그룹 상태 안내 테스트                 |
| AC-09 | 통과           | `collection-engine.test.ts`의 2초 고정 시각·skip 계측, `provider-smoke.json`                  |
| AC-10 | 통과           | `exchange-rates.test.ts`의 과거 방향 forward-fill 및 실제 환율 기준일 기록                    |
| AC-11 | 통과           | 포트폴리오·시장 E2E의 최초 로컬 저장 확인 대화상자                                            |
| AC-12 | 통과           | 설정 테스트의 5초 적용, `provider-smoke-candidate.json`의 5초 고정 시각 측정                  |
| AC-13 | 통과           | `apply-config.test.ts`의 누락·비숫자·비정수·최솟값 보정과 로그 필드                           |
| AC-14 | 통과           | 서버 DTO의 적용 주기와 `market-dashboard.test.tsx`의 DTO 기반 refetch 주기                    |
| AC-15 | 통과           | 네 그룹 독립 상태 머신, 브라우저 구독 동기화와 기본·후보 1분 실공급원 스모크                  |
| AC-16 | 통과           | `market-dashboard.test.tsx`의 검색 입력 보존, E2E 키보드·입력 보존 흐름                       |
| AC-17 | 후속 경계 통과 | 브라우저가 서버 API만 조회하고 공급원을 직접 호출하지 않는 포트 경계; 분리 배포 자체는 MVP 밖 |
| AC-18 | 후속 경계 통과 | `apply-config.test.ts`의 server/client 주기 기본값 보정 계약; 분리 배포 자체는 MVP 밖         |
| AC-19 | 통과           | `collection-engine.test.ts`의 0·6·12·18초 요청, 5초 timeout, delayed·skip 상태                |
| AC-20 | 통과           | 저장소 한도 테스트와 시장·포트폴리오 UI의 한도·삭제 방법·신규 추가 차단 안내                  |
| AC-21 | 통과           | 배치 부분 성공 보존, 성공/실패 배치 UI와 실스모크의 관심 종목 20개/2배치                      |
| AC-22 | 통과           | 23초 중단 상태 머신, 그룹 retry/reset API와 그룹 재시도·새로고침 E2E                          |
| AC-23 | 통과           | `provider-stability.json`: 3,600초·61개 메모리 표본·오류율/429/연결 회복·예외 계측            |
| AC-24 | 통과           | `market-dashboard.test.tsx`의 지수 최대 5년·개별 종목 최대 10년, 포트폴리오 최대 10년 UI      |
| AC-25 | 통과           | `apply-config.test.ts`의 유효 설정 적용 및 runtime의 timeout/batch/limit 연결                 |
| AC-26 | 통과           | `apply-config.test.ts`의 다섯 설정 기본값·최솟값·batch clamp 검증                             |
| AC-27 | 통과           | `local-user-data-repository.test.ts`의 설정 축소 시 기존 데이터 보존·신규 추가 차단           |
| AC-28 | 통과           | `collection-engine.test.ts`의 일반 조회 실패와 자동 실패 카운터 분리                          |
| AC-29 | 통과           | `collection-engine.test.ts`의 장 재개 T0 재설정·미소급·실패 상태 보존                         |

## 실행 증거

| 검증                      | 증거                                                         |
| ------------------------- | ------------------------------------------------------------ |
| 정적 품질·단위·통합       | `pnpm validate`                                              |
| 브라우저 핵심 흐름·접근성 | `pnpm test:e2e`                                              |
| 프로덕션 번들             | `pnpm build`                                                 |
| 깨끗한 DB migration       | `repositories.test.ts`의 clean database 사례                 |
| 기존 fixture DB migration | 같은 테스트 파일의 migration 재적용·`app_metadata` 보존 사례 |
| 기본 2초 실스모크         | `docs/validation/provider-smoke.json`                        |
| 운영 후보 5초 실스모크    | `docs/validation/provider-smoke-candidate.json`              |
| 1시간 안정성              | `docs/validation/provider-stability.json`                    |
| 프로덕션 성능             | `docs/validation/app-performance.json`                       |

실공급원 결과는 해당 시점의 로컬 측정이며 Yahoo Finance의 SLA를 의미하지 않는다. 장 마감·장 재개가
측정 창에 포함되지 않은 경우 그 전환은 fake clock 상태 머신 테스트를 수용 증거로 사용한다.
프로덕션 성능 측정은 첫 화면 434.93ms, 검색 939.74ms, 필터 47.11ms, 정렬 15.05ms였다. 정렬은 외부
장기 데이터 수집 시간과 분리하기 위해 공개 계약과 같은 fixture로 클라이언트 반영 시간만 측정했다.
