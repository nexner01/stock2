# Stock2 구현 진행 기록

최종 갱신: 2026-09-16

## 단계 상태

| 단계                                | 상태 | 요약                                                                                         |
| ----------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| M0 — 개발 전 검증과 결정            | 완료 | Yahoo 공급원 capability, 이용 제한, 심볼, 기간/간격, 배치와 2초 부하를 실측하고 ADR로 결정함 |
| M1 — 프로젝트 기반과 개발 품질 도구 | 완료 | Next.js 모듈형 모놀리스 기반, 품질 도구, SQLite, 테스트와 계층 경계를 구성함                 |
| M2 — 도메인 모델, 계약과 설정       | 완료 | 값 객체·수집 상태·설정 계약·성과 계산과 분석 기간 정책을 구현함                              |
| M3 — 데이터 공급원과 영속성         | 완료 | SQLite 저장소·원자적 정상 스냅샷과 Yahoo 서버 어댑터를 구현함                                |
| M4 — 고정 시각 수집 엔진            | 완료 | 고정 T0 스케줄, 네 그룹 상태 머신, timeout·재시도·복구를 구현함                              |
| M5 — 시황, 검색과 종목 상세         | 완료 | API 계약, 반응형 시장 화면, ECharts, 부분 갱신, E2E·시각 QA                                  |
| M6 — 관심 종목·포트폴리오           | 완료 | versioned localStorage, 관심 종목, 원화 평가, 저장·삭제 확인, E2E·시각 QA                    |
| M7 — 과거 추정 가치·추천 백테스트   | 완료 | 공통 시작일, 과거 환율, 4개 추천안, 월별 리밸런싱, 복사·덮어쓰기 보호                        |
| M8~M9                               | 대기 | 선행 단계 완료 후 순차 진행                                                                  |

## M0 — 개발 전 검증과 결정

상태: 완료

### 수행한 작업

- `scripts/validate-provider.ts`에 재현 가능한 capability probe와 고정 시각 1분 smoke 측정을 구현했다.
- `^KS11`, `^KQ11`, `^IXIC`, `^GSPC`, `KRW=X`와 PDD 추천 ETF 9개의 Yahoo 심볼·거래소·통화를 확인했다.
- AAPL과 `005930.KS`로 1분·5분·15분·1시간·1일 간격 및 최대 10년 표본을 검증했다.
- quote 4·10·20개 배치가 성공했지만 공식 상한은 공개되지 않았으므로 적용 기본 배치 10개를 유지했다.
- 공급원 세션 준비 후 2초 고정 시각으로 네 그룹을 60초간 측정했다. 각 그룹이 30/30회 성공했고
  delayed, skip, HTTP 429가 모두 0회였다. 세션 준비 전 첫 측정에서는 초기화 비용 때문에 그룹별 1회
  skip이 발생했으므로 수집 엔진은 공급원 세션 준비 완료 시각을 T0로 사용해야 한다.
- Yahoo 한국어 이름 직접 검색은 `Invalid Search Query`로 확인됐다. 티커·영문명은 지원하며 한국어 검색은
  검증된 별칭/종목 마스터가 준비되기 전까지 비지원 사유를 표시해야 한다.
- Yahoo의 재배포 금지와 한국거래소/KOSDAQ 20분 지연을 확인했다. 현재 공급원 결정은 로컬 MVP에만
  유효하며 외부 공개 전에 라이선스와 정식 공급원을 재검토해야 한다.

### 산출물

- `docs/adr/0001-application-architecture.md`
- `docs/adr/0002-market-data-provider.md`
- `docs/provider-capability-matrix.md`
- `docs/validation/provider-probe.json`
- `docs/validation/provider-smoke.json`

### 검증

- `pnpm provider:probe`: 24개 항목 중 23개 지원, 한국어 이름 검색 1개 예상 비지원, 예상 밖 실패 0개
- `pnpm provider:smoke`: 통과, 네 그룹 모두 성공 30/30·delayed 0·skip 0·HTTP 429 0

관련 요구사항: PDD FR-01~~FR-06, FR-12~~FR-15, 구현 계획 M0.

## M1 — 프로젝트 기반과 개발 품질 도구

상태: 완료

### 수행한 작업

- Node.js 24 LTS, pnpm 11, TypeScript 6 strict, Next.js 16 App Router 프로젝트를 구성했다.
- Tailwind CSS 4와 shadcn/ui 방식의 저장소 소유 `Button` primitive 및 다크 애플리케이션 셸을 만들었다.
- ESLint, Prettier, dependency-cruiser의 계층/순환 검사와 `server-only` 경계를 설정했다.
- Vitest, Testing Library, MSW, Playwright와 axe-core smoke test를 구성했다.
- Drizzle ORM과 better-sqlite3, 초기 `app_metadata` schema/migration을 구성하고 로컬 DB에 적용했다.
- 환경 입력을 한 곳에서 읽는 `src/config` 골격과 안전한 `.env.example`을 추가했다. 실제 Zod 보정 로직은
  계획대로 M2에서 구현한다.
- `src/app`, `features`, `application`, `domain`, `ports`, `infrastructure`, `contracts`, `config`,
  `components`, `test` 경계를 만들고 README에 실제 명령을 기록했다.
- Next.js/React lint 플러그인의 ESLint 10 미지원 때문에 호환되는 ESLint 9.39.5를 고정했다. 이 버전은 설치
  시 지원 종료 경고가 있으므로 Next.js 플러그인이 ESLint 10을 지원하면 함께 올려야 한다.

### 검증 결과

| 명령                             | 결과                                                                    |
| -------------------------------- | ----------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | 통과, lockfile과 설치 상태 일치                                         |
| `pnpm validate`                  | 통과: lint, typecheck, Vitest 1/1, 경계 검사 29 modules/22 dependencies |
| `pnpm db:generate`               | 통과: 초기 migration 생성                                               |
| `pnpm db:migrate`                | 통과: 로컬 SQLite 적용                                                  |
| `pnpm test:e2e`                  | 통과: Chrome Playwright 1/1, axe serious/critical 위반 0                |
| `pnpm build`                     | 통과: `/`와 `/_not-found` 정적 빌드                                     |

관련 요구사항: 구현 계획 M1 완료 기준. 제품 기능 수용 조건은 M2 이후에 연결한다.

## M2 — 도메인 모델, 계약과 설정

상태: 완료

### 수행한 작업

- `{ symbol, exchange }` 종목 식별자, KRW/USD 통화, 간격과 시장 상태를 검증하는 값 객체를 구현했다.
- OHLCV를 Decimal과 Temporal 기반으로 모델링하고 가격 관계, 거래량, UTC 시각 및
  `symbol + exchange + interval + timestamp + source` 식별 규칙을 검증했다.
- `marketTimestamp`, `collectedAt`, 데이터 범위·누락 구간, 최신 수집 결과, 마지막 정상 스냅샷과
  배치별 성공/실패를 서로 다른 모델로 분리했다.
- 그룹 상태를 `loading | healthy | partial | delayed | stale | failed | empty` 판별 union으로 정의했다.
- 환경 입력을 Zod 경계에서 읽어 불변 `AppliedConfig`로 보정하고, 기본값·최솟값·배치 상한 및 보정
  사유의 Pino 구조화 로그를 구현했다.
- 현재 조회 주기와 향후 서버/클라이언트 주기 설정에 같은 최소 2초 정책을 적용할 수 있는 검증 함수를
  제공해 AC-18 경계를 고정했다.
- 공개 DTO에서 Decimal 값을 문자열, 시각을 UTC ISO 8601로 강제하고 OHLCV 필수 식별 필드를 평탄하게
  노출했다.
- 일별·누적 수익률, CAGR, 연환산 변동성, MDD와 고점/저점일을 결정론적 순수 함수로 구현했다.
- 과거 환율은 가격일 이하의 가장 최근 값만 forward-fill하며 실제 적용 환율일을 결과에 기록하도록 했다.
- 공통 데이터 시작일, 상장 전 무값 처리, 실행 단위 종목 제외와 취소 정책을 저장 데이터 변경 없이
  계산하도록 구현했다.

### 검증 결과

| 명령                             | 결과                                                                        |
| -------------------------------- | --------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | 통과, Zod 추가 후 lockfile과 설치 상태 일치                                 |
| `pnpm validate`                  | 통과: lint, typecheck, Vitest 9개 파일 58개 테스트, 계층·순환 검사 위반 0건 |
| `pnpm test:e2e`                  | 통과: Chrome Playwright 1/1, axe serious/critical 위반 0                    |
| `pnpm build`                     | 통과: `/`와 `/_not-found` 정적 빌드                                         |

자동 추적 요구사항: PDD §7, AC-03, AC-04, AC-05, AC-10, AC-13, AC-18, AC-26.

### 구현 경로

- 도메인 값과 시각: `src/domain/instruments.ts`, `src/domain/numbers.ts`, `src/domain/time.ts`
- 시장 데이터와 상태: `src/domain/market-data/ohlcv.ts`, `src/domain/market-data/collection.ts`
- 분석 계산과 정책: `src/domain/portfolios/performance.ts`, `exchange-rates.ts`, `analysis-start.ts`
- 설정: `src/config/types.ts`, `src/config/apply-config.ts`, `src/config/load-config.ts`
- 공개 계약: `src/contracts/common.ts`, `src/contracts/config.ts`, `src/contracts/market-data.ts`
- 구조화 로그: `src/infrastructure/logging/index.ts`

### 결정 기록

- PDD가 표본/모집단 분모를 정하지 않은 연환산 변동성은 일별 수익률의 모집단 표준편차에 `sqrt(252)`를
  곱한다. 공급원/상품 정의가 달라지면 ADR과 fixture를 함께 바꾼다.
- MVP 지원 통화는 현재 검증된 KRW와 USD로 제한한다. 미지원 통화를 조용히 통과시키지 않는다.
- `AppliedConfig`의 내부 키는 PDD의 snake case를 유지해 서버 적용값과 클라이언트 계약의 의미 차이를
  없앴다.

## M3 — 데이터 저장소와 Yahoo Finance 어댑터

상태: 완료

### 수행한 작업

- instrument, OHLCV, quote/index snapshot, collection run, group state, 최신 수집 결과와 마지막 정상
  스냅샷의 SQLite schema를 만들었다.
- OHLCV 복합 식별자를 unique constraint로 보장하고 음수 값, 비정수 거래량, OHLC 가격 관계와 UTC
  timestamp를 DB check constraint로 검증했다.
- 모든 수집 시도·그룹 상태·최신 결과를 한 transaction으로 기록하고, `healthy` 상태에서 전체 검증이
  성공한 경우에만 별도 정상 스냅샷을 원자적으로 교체하는 repository를 구현했다.
- OHLCV 저장소는 Decimal 문자열과 UTC ISO 시각을 보존하며 복합 키 충돌 시 같은 레코드를 갱신한다.
- 지수, quote batch, 검색, 종목 상세, OHLCV와 USD/KRW 환율 조회를 `MarketDataProvider` port로 정의했다.
- Yahoo 응답은 Zod로 검증한 뒤 도메인 mapper만 통해 값 객체로 변환하도록 했다.
- KOSPI/KOSDAQ/NASDAQ/S&P 500, 한국 종목 접미사, 미국 거래소, `KRW=X` 매핑을 Yahoo adapter 내부에
  격리했다.
- 모든 Yahoo 호출에 `AbortSignal.timeout`을 적용하고 timeout, rate limit, unsupported, not found,
  malformed response를 안정된 오류 코드와 한국어 메시지로 분류했다.
- 고정 fixture 계약 테스트에서 필수 필드 누락, 음수 거래량, OHLC 관계 오류, 중복 timestamp와 공급원
  심볼 불일치를 거부하도록 검증했다. 단위 테스트는 실 네트워크를 호출하지 않는다.
- `drizzle/0001_famous_gertrude_yorkes.sql` migration을 생성하고 M1 로컬 DB에 적용해 기존 DB 업그레이드
  경로를 확인했다. seed 데이터는 migration에 포함하지 않았다.

### 검증 결과

| 명령               | 결과                                                                            |
| ------------------ | ------------------------------------------------------------------------------- |
| `pnpm db:generate` | 통과: M3의 8개 신규 테이블과 constraint migration 생성                          |
| `pnpm db:migrate`  | 통과: M1 로컬 SQLite DB에 M3 migration 적용                                     |
| `pnpm validate`    | 통과: lint, typecheck, Vitest 12개 파일 81개 테스트, 계층·순환 검사 위반 0건    |
| `pnpm test:e2e`    | 통과: Chrome Playwright 1/1, axe serious/critical 위반 0                        |
| `pnpm build`       | 통과: 서버 전용 Yahoo/SQLite 모듈이 클라이언트 번들에 노출되지 않고 정적 빌드됨 |

자동 추적 요구사항: PDD FR-04, §8.1~§8.4, AC-01, AC-02, AC-03, AC-08.

### 구현 경로

- 포트: `src/ports/market-data-provider.ts`, `collection-snapshot-repository.ts`, `ohlcv-repository.ts`
- SQLite schema와 저장소: `src/infrastructure/persistence/sqlite/schema.ts`,
  `collection-snapshot-repository.ts`, `ohlcv-repository.ts`
- Yahoo adapter: `src/infrastructure/providers/yahoo-finance/adapter.ts`, `client.ts`, `schemas.ts`,
  `mapper.ts`, `symbol-map.ts`, `errors.ts`
- 고정 공급원 fixture: `src/test/fixtures/yahoo/*.json`
- 결정 기록: `docs/adr/0003-market-data-persistence.md`

### 결정 기록

- 최신 결과와 마지막 정상 결과는 테이블을 분리한다. 실패 또는 검증 실패 payload는 정상 스냅샷에
  합치지 않는다.
- Decimal은 SQLite `TEXT`, 시각은 UTC ISO 8601 `TEXT`로 저장한다. DB 관계 check의 `REAL` 변환은
  방어적 제약이며 실제 정밀 계산은 도메인 Decimal이 담당한다.
- Next.js는 기본 Node.js runtime을 사용하고 Yahoo 및 better-sqlite3 모듈을 `server-only` 경계 뒤에 둔다.

## M4 — 고정 시각 수집 엔진과 그룹 상태 머신

상태: 완료

### 수행한 작업

- `Clock`과 `Scheduler` port, Node용 system 구현과 fake clock 테스트 구현을 추가했다.
- 공급원 준비 후 `start()` 시각을 T0로 사용하고 `T0 + interval × n`에서 네 그룹을 독립 실행한다.
- 실행 중 다음 회차는 해당 그룹만 skip하고, 빈 관심 종목·포트폴리오는 외부 호출 없이 `empty`로 저장한다.
- 적용 batch size로 요청을 나누고 일부 batch 실패 시 성공 값은 유지한 채 `partial`로 기록한다.
- scheduler timeout이 실제 `AbortSignal`을 취소하며 최초 실패와 세 번의 재요청이 모두 실패한 그룹만
  중단한다.
- 성공 시 연속 실패와 delayed 상태를 초기화하고 그룹별 다시 시도와 전체 초기화를 분리했다.
- 일반 조회는 자동 상태 머신과 실패 횟수를 변경하지 않으며 장 마감·휴장은 `paused`로 처리한다.
- 장중 전환 감지 시각을 새 T0로 사용하고 중지 기간을 소급하지 않으며 기존 실패 상태를 보존한다.

### 검증 결과

| 명령            | 결과                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| `pnpm validate` | 통과: lint, typecheck, Vitest 13개 파일 88개 테스트, 계층·순환 검사 위반 0건        |
| `pnpm build`    | 통과: Node scheduler는 서버 전용 경계에 유지되고 애플리케이션 상태 머신은 번들 가능 |

fake clock으로 2초 정상 틱, 빈 그룹, 부분 성공, 성공 복구, 수동 조회 독립성, 그룹/전체 초기화,
0·6·12·18초 시작과 23초 중단, 그룹 간 timeout 독립성, 장 재개 T0 재설정을 실제 대기 없이 검증했다.

관련 요구사항: AC-09, AC-12~AC-15, AC-19, AC-21, AC-22, AC-28, AC-29.

### 구현 경로

- 포트: `src/ports/clock-scheduler.ts`
- 상태 머신: `src/application/market-data/collection-engine.ts`
- Node scheduler: `src/infrastructure/polling/system-scheduler.ts`
- 결정론적 테스트: `src/application/market-data/collection-engine.test.ts`
- 결정 기록: `docs/adr/0004-fixed-time-collection-engine.md`

## M5 — 시황, 검색과 종목 상세

상태: 완료

### 수행한 작업

- 지수·인기·관심 종목 그룹과 종목 상세·검색 DTO를 Zod 계약으로 만들고 세 개의 얇은 route handler를 연결했다.
- 공통 헤더, 검색, 4열 지수 카드, 종목 요약, 기간/차트 전환, SVG ECharts 가격·거래량, 인기 종목 표,
  관심 종목·시장 흐름 보조 패널을 디자인 샘플의 다크 금융 화면으로 구현했다.
- TanStack Query가 서버 적용 조회 주기를 응답에서 읽어 갱신하고 검색어·선택 기간·차트 유형을 query
  데이터와 분리해 백그라운드 갱신 중 보존한다.
- 상승·하락은 색상과 부호를 함께 사용하고, 차트에는 실제 범위·간격·최근 조정 종가의 텍스트 대안을
  제공했다. 모든 표는 의미 있는 헤더를 사용하고 좁은 화면에서 가로 스크롤된다.
- route handler와 구체 어댑터 사이에 `src/composition` 조립 경계를 두고, SQLite 연결은 요청 시점까지
  지연해 Next 빌드 worker의 동시 WAL 초기화 충돌을 제거했다.
- 고정 API fixture로 검색→상세→캔들 전환, 입력 보존과 axe 접근성을 브라우저에서 검증하고 전체 화면
  캡처를 `docs/validation/m5-market-overview.png`에 남겼다.

### 검증 결과

| 명령            | 결과                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| `pnpm validate` | 통과: lint, typecheck, Vitest 14개 파일 91개 테스트, 계층·순환 위반 0건 |
| `pnpm test:e2e` | 통과: Chrome 1/1, 검색·차트 전환·입력 보존, axe serious/critical 0건    |
| `pnpm build`    | 통과: 정적 홈과 동적 시장 API 3개, 빌드 시 DB 부작용 없음               |
| 시각 QA         | `design-qa.md` 최종 결과 `passed`; 구현 캡처 원본 해상도 직접 확인      |

관련 요구사항: 흐름 A/B, AC-01, AC-02, AC-09, AC-15, AC-16, AC-19, AC-24.

### 구현 경로

- 화면: `src/features/market-overview/market-dashboard.tsx`, `src/app/globals.css`
- 공용 UI: `src/components/app-header.tsx`, `panel.tsx`, `data-status/status-badge.tsx`
- 차트: `src/components/charts/market-chart.tsx`
- API/계약: `src/app/api/market/**`, `src/contracts/market-overview.ts`
- 조립: `src/composition/market-runtime.ts`, `src/infrastructure/runtime/market-runtime.ts`
- 검증: `src/features/market-overview/market-dashboard.test.tsx`, `tests/e2e/smoke.spec.ts`, `design-qa.md`

## M6 — 관심 종목과 사용자 포트폴리오

상태: 완료

### 수행한 작업

- 관심 종목과 여러 포트폴리오의 version 1 Zod schema와 localStorage repository를 만들고 legacy migration,
  손상 데이터 빈 상태 복구와 거래소+티커 중복 제거를 구현했다.
- 서버 적용 한도를 overview 계약으로 전달한다. 설정 축소 시 기존 데이터는 유지하고 신규 추가만 막는다.
- 종목 상세에서 관심 종목 추가/제거를 제공하며 최초 저장 전에 기기 한정·복구 불가 가능성을 확인한다.
- 양수 Decimal 수량과 중복을 검증하고 최신 가격·USD/KRW 환율로 원화 평가금액·전체 금액·비중을 계산한다.
- 전체 초기화는 확인 후에만 수행하며 취소 시 저장 데이터와 UI를 변경하지 않는다.

### 검증 결과

| 명령            | 결과                                                             |
| --------------- | ---------------------------------------------------------------- |
| `pnpm validate` | 통과: Vitest 15개 파일 96개 테스트, 계층·순환 위반 0건           |
| `pnpm test:e2e` | 통과 2/2: 관심 종목, 저장·복원, 삭제 취소, axe 중대 위반 0건     |
| `pnpm build`    | 통과: `/portfolio`, `/api/market/fx` 포함                        |
| 시각 QA         | `docs/validation/m6-portfolio.png`, `design-qa.md` 결과 `passed` |

관련 요구사항: AC-11, AC-16, AC-20, AC-25, AC-27.

### 구현 경로

- 저장 계약/adapter: `src/ports/user-data-repository.ts`, `src/infrastructure/persistence/browser/local-user-data-repository.ts`
- 포트폴리오 UI: `src/app/portfolio/page.tsx`, `src/features/portfolio-analysis/portfolio-dashboard.tsx`
- 환율 API: `src/app/api/market/fx/route.ts`

## M7 — 과거 추정 가치와 추천 포트폴리오

상태: 완료

### 수행한 작업

- 현재 보유 수량·조정 종가·과거 방향 환율을 결합하는 결정론적 추정 가치 계산과 API를 구현했다.
- 6개월~10년 기간, 공통 시작일, 이력 짧은 종목 영향 표시, 공통 기간/이번 실행 제외/취소 선택을 연결했다.
- PDD의 Stock 80/Bond 20, Momentum 60/40, All Weather, Golden Butterfly 구성과 DBC를 seed로 고정했다.
- 초기금 1,000만 원, 소수점 매수, 조정 종가/배당 재투자, 월별 리밸런싱, 수수료·세금 0원으로 공통
  날짜의 KRW 가격 백테스트를 수행하고 누적 수익률·CAGR·변동성·MDD 날짜를 반환한다.
- 추천 카드는 MDD 기본 정렬과 수익률·변동성·종목 수 정렬, 원형 차트와 동등한 표를 제공한다.
- 새 포트폴리오 복사를 기본으로 하고 덮어쓰기는 전후 구성 미리보기와 확인을 요구한다.

### 검증 결과

| 명령            | 결과                                                               |
| --------------- | ------------------------------------------------------------------ |
| `pnpm validate` | 통과: 17개 파일 100개 테스트, 계층·순환 위반 0건                   |
| `pnpm test:e2e` | 통과 3/3: 추정 가치, 복사, 덮어쓰기 취소 무변경, axe 중대 위반 0건 |
| `pnpm build`    | 통과: 분석/추천 API와 `/recommendations` 포함                      |
| 시각 QA         | 추천 2열 카드 캡처 직접 검사, `design-qa.md` 결과 `passed`         |

관련 요구사항: 흐름 C/D, AC-04~AC-07, AC-10.

### 구현 경로

- 계산: `src/domain/portfolios/historical-value.ts`, `src/domain/backtesting/recommended-portfolios.ts`
- API: `src/app/api/portfolio-analysis/route.ts`, `src/app/api/recommendations/route.ts`
- UI: `src/components/charts/historical-value-chart.tsx`, `src/features/recommended-portfolios/recommendations-dashboard.tsx`
- 계약: `src/contracts/analysis.ts`

## 다음 개발자 참고

1. M6의 localStorage repository는 React 컴포넌트가 직접 저장소 API를 호출하지 않도록 feature hook 뒤에 둔다.
2. M6에서 관심 종목/포트폴리오 심볼을 수집 엔진 그룹 정의에 주입할 때 브라우저 저장값을 서버가 자동
   소유한다고 가정하지 말고 명시적 요청 계약으로 전달한다.
3. 한국어 종목명 검색을 임의 영문 치환으로 구현하지 않는다. 신뢰 가능한 한국어 종목 마스터를 검증한 뒤
   PDD/ADR에 근거를 추가한다.
4. `docs/validation/*`은 2026-09-16 단일 환경의 증거이며 SLA가 아니다. M9에서 다시 측정한다.
