# Stock2 구현 진행 기록

최종 갱신: 2026-09-16

## 단계 상태

| 단계                                | 상태 | 요약                                                                                         |
| ----------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| M0 — 개발 전 검증과 결정            | 완료 | Yahoo 공급원 capability, 이용 제한, 심볼, 기간/간격, 배치와 2초 부하를 실측하고 ADR로 결정함 |
| M1 — 프로젝트 기반과 개발 품질 도구 | 완료 | Next.js 모듈형 모놀리스 기반, 품질 도구, SQLite, 테스트와 계층 경계를 구성함                 |
| M2 — 도메인 모델, 계약과 설정       | 완료 | 값 객체·수집 상태·설정 계약·성과 계산과 분석 기간 정책을 구현함                              |
| M3 — 데이터 공급원과 영속성         | 대기 | 다음 구현 단계                                                                               |
| M4~M9                               | 대기 | 선행 단계 완료 후 순차 진행                                                                  |

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

## 다음 개발자 참고

1. M3 Yahoo adapter는 반드시 `src/infrastructure/providers/yahoo-finance` 아래 서버 경계에 두고 브라우저에서
   직접 import하지 않는다.
2. 공급원 원본 응답은 Zod 검증과 명시적 mapper를 거쳐야 하며 malformed OHLCV를 정상 스냅샷에
   합치지 않는다.
3. SQLite에는 OHLCV 복합 unique constraint와 최신 수집/마지막 정상 스냅샷의 분리 저장을 구현한다.
4. 수집 스케줄러의 T0는 공급원 세션 준비가 끝난 뒤 설정한다. 세션 준비 전 측정의 첫 틱 skip을 회귀
   테스트로 남긴다.
5. 한국어 종목명 검색을 임의 영문 치환으로 구현하지 않는다. 신뢰 가능한 한국어 종목 마스터를 검증한 뒤
   PDD/ADR에 근거를 추가한다.
6. `docs/validation/*.json`은 2026-09-16 단일 환경의 증거이며 SLA가 아니다. M9에서 다시 측정한다.
