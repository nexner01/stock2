# Stock2 아키텍처와 파일 역할

이 문서는 M4 완료 시점의 코드 지도를 제공한다. 제품 요구사항은
`memory-bank/product-design-document.md`, 개발 순서와 완료 기준은
`memory-bank/implementation-plan.md`, 실제 완료 내역은 `memory-bank/progress.md`를 기준으로 한다.

## 1. 아키텍처 개요

```text
Browser
  -> src/app, src/features, src/components
    -> src/application
      -> src/domain
      -> src/ports
        <- src/infrastructure (Node.js only)

src/contracts = 서버/클라이언트 직렬화 경계
src/config    = 환경 입력을 읽고 적용 설정으로 바꾸는 유일한 경계
```

의존 방향은 바깥 계층에서 안쪽 계층으로만 향한다. 도메인은 React, Next.js, Yahoo Finance, SQLite와
환경 변수를 모른다. 공급원과 DB 구현은 `server-only`로 표시하고 Node.js 런타임에서만 실행한다. 현재는
하나의 Next.js 프로세스로 실행하지만 포트와 DTO가 배포 경계를 대신하므로 후속 서버/클라이언트 분리 시
도메인 계산을 옮기지 않아도 된다.

## 2. 핵심 통찰

### 수집 원점은 프로세스 시작과 다르다

Yahoo 세션을 준비하지 않은 첫 2초 측정에서는 초기화 비용으로 네 그룹 모두 한 회차를 건너뛰었다.
세션 준비 후에는 60초 동안 그룹별 30/30회가 성공했다. 따라서 M4 스케줄러의 `T0`는 프로세스 시작
시각이 아니라 공급원 어댑터가 준비됐음을 확인한 시각이어야 한다. 준비 실패를 정상 수집 실패와 섞지
말고 시작 상태로 모델링해야 한다.

### 수집 빈도와 데이터 신선도는 별개다

2초 폴링이 성공해도 Yahoo 안내상 한국거래소와 KOSDAQ 데이터는 20분 지연될 수 있다. UI의 조회 주기,
`marketTimestamp`, `collectedAt`과 시장별 지연 안내를 분리해야 한다. 2초마다 같은 지연 데이터를 받는
상황도 정상 응답일 수 있다.

### 한국어 검색은 별도 신뢰 경계다

Yahoo 검색은 티커와 영문명 표본을 지원했지만 `삼성전자`를 거부했다. 한국어 이름을 임의 영문 변환하거나
고정 fixture로 정상 데이터처럼 만들면 안 된다. 검증된 종목 마스터/별칭 데이터가 들어오면 공급원 검색
앞의 독립 포트로 추가하고 `{ symbol, exchange }`로 Yahoo 결과와 결합한다.

### 로컬 MVP와 재배포 가능 제품은 같은 공급원 결정을 공유할 수 없다

Yahoo는 재배포 금지를 명시하고 `yahoo-finance2`도 비공식 API다. 현재 어댑터 선택은 개인 로컬 검증에만
유효하다. 외부 공개 범위가 생기면 UI를 바꾸기 전에 provider port의 새 구현과 데이터 라이선스를 먼저
결정해야 한다.

### 정밀도와 시각은 원시 타입이 아니라 경계 계약이다

가격·환율·수량·비율은 도메인에서 Decimal로 계산하고 공개 DTO에서는 문자열로만 전달한다. 시각은
Temporal의 UTC instant로 검증하며 DTO도 `Z`로 끝나는 ISO 8601만 허용한다. 이 경계를 우회해 JSON
number나 지역 시각 문자열을 추가하면 같은 입력에 대한 재현성과 시장 간 정렬이 깨진다.

### 적용 설정은 서버와 클라이언트가 공유하는 하나의 결과다

환경 변수는 `src/config`에서만 읽고 보정된 `AppliedConfig`를 계약으로 전달한다. UI나 스케줄러가 별도
기본값을 가지면 실제 조회 주기와 표시 문구가 달라질 수 있으므로 모든 소비자는 적용 설정만 사용한다.

### 정상 스냅샷은 최신 결과의 플래그가 아니라 별도 복구 자산이다

최신 수집 시도는 실패·부분 성공일 수 있으므로 `latest_collection_results`와 `healthy_snapshots`를
물리적으로 분리했다. 모든 시도는 기록하되 전체 검증 성공만 정상 스냅샷을 교체한다. M4 이후 수집기가
실패 payload를 전달해도 저장소 transaction이 마지막 정상 데이터를 보존한다.

### 공급원 타입은 신뢰 경계를 대신하지 않는다

`yahoo-finance2`의 TypeScript 타입을 그대로 도메인 계약으로 사용하지 않는다. 모든 응답은 Zod schema를
통과한 뒤 명시적 mapper로 Decimal·Temporal 값 객체가 된다. 라이브러리 버전이나 원본 필드가 바뀌면
adapter의 fixture 계약 테스트에서 실패하며 UI와 계산 계층에는 원본 형태가 전파되지 않는다.

### 취소와 타임아웃은 공급원 호출까지 전달된다

어댑터의 모든 메서드는 외부 `AbortSignal`과 적용 timeout signal을 결합하고 이를 Yahoo 요청의 fetch에
전달한다. Promise 경주만 종료하고 실제 HTTP 요청을 남기는 방식이 아니므로 M4의 회차 건너뛰기와 그룹
독립성을 구현할 기반이 된다.

### 고정 시각은 완료 시각이 아니라 T0에서 계산한다

수집 엔진은 이전 요청 완료 시각을 다음 회차 기준으로 사용하지 않는다. 각 그룹은 T0와 sequence를 갖고
`T0 + interval × n`을 예약한다. timeout이나 skip이 발생해도 다음 회차가 밀리지 않으며, 장 재개 때만
감지 시각을 새 T0로 사용한다.

## 3. 런타임 파일

| 파일                                                  | 역할                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/app/layout.tsx`                                  | 한국어 문서 메타데이터와 전역 레이아웃을 제공하는 Server Component 루트     |
| `src/app/page.tsx`                                    | M1 애플리케이션 셸을 렌더링하는 홈 Server Component                         |
| `src/app/globals.css`                                 | Tailwind 진입점과 초기 다크 테마·포커스·글꼴 기본값                         |
| `src/components/ui/button.tsx`                        | shadcn/ui 조합 방식을 따르는 저장소 소유 Button primitive                   |
| `src/lib/utils.ts`                                    | `clsx`와 `tailwind-merge`를 결합한 표현 계층 className 유틸리티             |
| `src/config/environment.ts`                           | `process.env`를 읽어 raw 입력만 반환하는 유일한 서버 경계                   |
| `src/config/index.ts`                                 | 검증된 적용 설정 로더를 노출하는 서버 전용 config 공개 API                  |
| `src/infrastructure/persistence/sqlite/schema.ts`     | 시장 데이터, 수집 run·상태, 최신/정상 snapshot의 Drizzle SQLite schema      |
| `src/infrastructure/persistence/sqlite/client.ts`     | lazy SQLite 연결, WAL 설정과 Drizzle client 생성. 브라우저 import 금지      |
| `src/infrastructure/persistence/sqlite/index.ts`      | SQLite adapter의 공개 API                                                   |
| `src/infrastructure/providers/yahoo-finance/index.ts` | 검증된 Yahoo adapter와 안정된 오류·심볼 API의 서버 전용 공개 경계           |
| `src/infrastructure/polling/index.ts`                 | M4 고정 시각 스케줄러 구현이 들어갈 서버 전용 공개 경계                     |
| `src/infrastructure/logging/index.ts`                 | 민감 필드 redaction을 적용한 Pino 서버 전용 로깅 adapter                    |
| `src/application/index.ts`                            | 프레임워크 독립 유스케이스의 공개 API 자리                                  |
| `src/domain/index.ts`                                 | 값 객체·시장 데이터 모델·포트폴리오 순수 계산의 공개 API                    |
| `src/ports/index.ts`                                  | provider와 repository 계약의 공개 API. M4에서 clock/scheduler가 추가될 경계 |
| `src/contracts/index.ts`                              | 설정·시장 데이터 Zod DTO와 mapper의 공개 API                                |
| `src/features/index.ts`                               | 화면 단위 상호작용 모듈의 공개 API 자리                                     |
| `src/components/charts/index.ts`                      | 접근 가능한 ECharts wrapper가 들어갈 공용 표현 경계                         |
| `src/components/data-status/index.ts`                 | loading/partial/delayed/stale/failed/empty 표현 컴포넌트 경계               |

빈 `index.ts`는 거대 배럴을 만들기 위한 파일이 아니라 미래 구현이 깊은 경로를 노출하지 않도록 공개
경계를 먼저 고정한 것이다. 실제 export가 생길 때만 해당 모듈의 공개 타입과 함수만 추가한다.

## 4. 테스트와 검증 파일

| 파일                                  | 역할                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `src/app/page.test.tsx`               | 애플리케이션 셸의 Vitest/Testing Library 단위 smoke test                    |
| `src/test/setup.ts`                   | jest-dom matcher와 MSW 서버 생명주기를 모든 단위 테스트에 연결              |
| `src/test/server.ts`                  | 네트워크 없는 단위/계약 테스트용 MSW Node server                            |
| `tests/e2e/smoke.spec.ts`             | Chrome에서 홈 진입과 axe serious/critical 위반 0건을 검증                   |
| `scripts/validate-provider.ts`        | Yahoo 심볼·검색·차트·배치 probe와 네 그룹 2초 고정 틱 1분 측정 도구         |
| `docs/validation/provider-probe.json` | 2026-09-16 capability probe의 원본 증거. 코드 fixture나 SLA로 사용하지 않음 |
| `docs/validation/provider-smoke.json` | 공급원 세션 준비 후 1분 부하 측정의 원본 증거                               |

## 5. 빌드·품질·도구 설정 파일

| 파일                      | 역할                                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| `package.json`            | 고정 의존성, Node/pnpm 범위와 개발·검증·DB·공급원 스크립트의 기준          |
| `pnpm-lock.yaml`          | 재현 가능한 의존성 해석의 단일 lockfile. 수동 편집 금지                    |
| `pnpm-workspace.yaml`     | 설치 스크립트 허용 목록과 공급망 검사 예외 버전을 기록                     |
| `.nvmrc`                  | 로컬 Node.js 24 선택 힌트                                                  |
| `tsconfig.json`           | strict, unchecked index, exact optional property 등 TypeScript 안전성 기준 |
| `next-env.d.ts`           | Next.js 타입 참조용 생성 파일. 수동 편집 금지                              |
| `next.config.ts`          | strict React, better-sqlite3 외부화, E2E 개발 origin 설정                  |
| `eslint.config.mjs`       | Next core web vitals/TypeScript 규칙과 config 외 `process.env` 접근 금지   |
| `.dependency-cruiser.cjs` | 순환, domain 외부 의존, application→adapter/UI, UI→infrastructure를 차단   |
| `prettier.config.mjs`     | 저장소 코드·문서의 기본 포맷 정책                                          |
| `.prettierignore`         | 생성물과 기준 문서·리뷰 아카이브가 기계적으로 재작성되지 않도록 보호       |
| `postcss.config.mjs`      | Tailwind CSS 4 PostCSS plugin 연결                                         |
| `components.json`         | shadcn/ui RSC, 경로 alias와 Lucide 아이콘 정책                             |
| `vitest.config.ts`        | jsdom, React, tsconfig path, 단일 worker와 공용 setup 설정                 |
| `playwright.config.ts`    | Chrome 프로젝트, 로컬 dev server, trace와 E2E 기준 URL 설정                |
| `drizzle.config.ts`       | SQLite dialect, schema, migration 출력과 로컬 DB 경로 설정                 |
| `.env.example`            | 비밀값 없는 환경 변수 이름과 PDD 기본값 예시                               |
| `.gitignore`              | 의존성, 빌드, 테스트 결과, 로컬 DB와 실제 환경 파일 제외                   |

## 6. 데이터베이스 파일

| 파일                                      | 역할                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| `drizzle/0000_tan_archangel.sql`          | `app_metadata` 초기 schema를 생성하는 첫 migration           |
| `drizzle/0001_famous_gertrude_yorkes.sql` | M3 시장 데이터·수집 상태·snapshot schema migration           |
| `drizzle/meta/0000_snapshot.json`         | Drizzle이 다음 migration 차이를 계산하는 생성 snapshot       |
| `drizzle/meta/_journal.json`              | migration 적용 순서를 기록하는 생성 journal                  |
| `drizzle/.gitkeep`                        | migration이 없을 때도 디렉터리 구조를 보존                   |
| `data/.gitkeep`                           | 로컬 SQLite 디렉터리만 보존. 실제 `.db`, WAL, SHM은 Git 제외 |

DB schema를 바꿀 때 generated meta를 직접 수정하지 않고 `pnpm db:generate`를 실행한다. migration은 깨끗한
DB와 기존 fixture DB 양쪽에서 검증한 뒤 커밋한다.

## 7. 제품·결정·운영 문서

| 파일/경로                                   | 역할                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| `AGENTS.md`                                 | 저장소 전체의 구조, 기술 스택, 안전성과 완료 기준            |
| `memory-bank/product-design-document.md`    | 제품 동작, 용어, 공식, 상태와 수용 조건의 기준               |
| `memory-bank/implementation-plan.md`        | M0~M9 의존 순서, 작업 목록과 단계 완료 기준                  |
| `memory-bank/progress.md`                   | 구현된 경로, 검증 명령·결과, 제약과 다음 개발자 인수인계     |
| `docs/adr/0001-application-architecture.md` | 모듈형 모놀리스와 Node 서버 경계 결정                        |
| `docs/adr/0002-market-data-provider.md`     | Yahoo adapter의 조건부 승인, 심볼, 지연과 이용 제한 결정     |
| `docs/adr/0003-market-data-persistence.md`  | 최신/정상 snapshot 분리와 원자적 교체·정밀 저장 결정         |
| `docs/provider-capability-matrix.md`        | 시장·심볼·기간/간격·검색·배치의 재현 가능한 조사 결과        |
| `README.md`                                 | 새 개발자가 그대로 실행할 설치, DB, 서버, 검사와 공급원 명령 |
| `architecture.md`                           | 현재 파일 지도와 계층을 가로지르는 설계 통찰(이 문서)        |

## 8. 입력 자산과 역사 자료

| 경로                     | 역할                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| `design_sample/*.png`    | 다섯 주요 화면의 시각적 source of truth. 런타임 이미지 자산으로 재사용 금지 |
| `review/review_a_ver*/`  | PDD 이전 버전에 대한 검토 기록. 런타임·현재 요구사항 기준이 아님            |
| `review/review_md_ver1/` | 개발 규칙 검토 기록. 현재 실행 규칙은 루트 `AGENTS.md`가 우선               |

## 9. M2 추가 파일 역할

| 파일                                           | 역할                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `src/domain/instruments.ts`                    | 종목 식별자, 지원 통화, 간격과 시장 상태를 검증하는 값 객체            |
| `src/domain/numbers.ts`                        | 가격·환율·수량·비율과 통화 포함 금액을 Decimal로 생성하는 정밀도 경계  |
| `src/domain/time.ts`                           | UTC instant와 날짜를 Temporal로 파싱·검증하는 순수 유틸리티            |
| `src/domain/market-data/ohlcv.ts`              | OHLCV 관계·거래량 검증과 복합 식별 키 생성                             |
| `src/domain/market-data/collection.ts`         | 데이터 범위·누락, 그룹 상태, 배치 결과, 최신 시도와 정상 스냅샷 모델   |
| `src/domain/portfolios/performance.ts`         | 수익률, CAGR, 연환산 변동성과 MDD를 계산하고 가정을 반환하는 순수 함수 |
| `src/domain/portfolios/exchange-rates.ts`      | 미래 값을 사용하지 않는 과거 환율 forward-fill과 적용일 추적           |
| `src/domain/portfolios/analysis-start.ts`      | 공통 시작일, 이번 실행만 종목 제외, 취소 정책을 저장 변경 없이 결정    |
| `src/config/types.ts`                          | raw 환경 입력, 불변 적용 설정과 보정 로그의 타입 계약                  |
| `src/config/apply-config.ts`                   | PDD 기본값·최솟값·배치 상한을 적용하고 보정 사유를 기록                |
| `src/config/load-config.ts`                    | 서버 환경 입력과 로거를 적용 설정 생성에 연결하는 조립 경계            |
| `src/contracts/common.ts`                      | Decimal 문자열과 UTC ISO instant의 공용 Zod scalar 계약                |
| `src/contracts/config.ts`                      | 서버가 검증한 적용 설정을 클라이언트에 전달하는 DTO와 mapper           |
| `src/contracts/market-data.ts`                 | 종목과 OHLCV 필수 필드를 공급원/도메인 객체와 분리한 공개 DTO          |
| `src/infrastructure/logging/index.ts`          | 민감 필드 redaction을 포함한 서버 전용 Pino 구조화 로거                |
| `src/domain/instruments.test.ts`               | 종목 식별자·통화·간격·시장 상태의 정상화와 거부 조건 검증              |
| `src/domain/market-data/ohlcv.test.ts`         | OHLCV 관계, 거래량, UTC 시각과 복합 식별 키 검증                       |
| `src/domain/portfolios/performance.test.ts`    | 성과 지표, 1년 미만 정책, MDD 날짜와 결정론 검증                       |
| `src/domain/portfolios/exchange-rates.test.ts` | 과거 방향 환율 채움, 최초 환율 전 무값과 적용일 검증                   |
| `src/domain/portfolios/analysis-start.test.ts` | 공통 기간·실행 단위 제외·취소와 입력 불변성 검증                       |
| `src/config/apply-config.test.ts`              | 누락·비숫자·비정수·범위·배치 상한과 현재/향후 조회 주기 보정 검증      |
| `src/contracts/common.test.ts`                 | JSON number 및 비 UTC 시각을 공개 scalar 계약이 거부하는지 검증        |
| `src/contracts/market-data.test.ts`            | OHLCV 필수 식별 필드와 Decimal 문자열 직렬화 검증                      |

기존 `src/config/environment.ts`는 raw 환경 입력만 읽고, `src/config/index.ts`는 적용 설정 로더의 서버 전용
공개 API를 제공한다. `src/domain/index.ts`와 `src/contracts/index.ts`는 각 계층이 허용한 타입과 함수만
노출한다.

## 10. M3 추가 파일 역할

| 파일                                                                      | 역할                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/domain/market-data/quotes.ts`                                        | quote, 검색 결과, 종목 상세와 환율 관측의 공급원 독립 도메인 모델                 |
| `src/ports/market-data-provider.ts`                                       | 지수·quote·검색·상세·OHLCV·환율 조회의 애플리케이션 공급원 계약                   |
| `src/ports/collection-snapshot-repository.ts`                             | 그룹별 수집 결과와 최신/정상 snapshot 저장 계약 및 JSON 값 타입                   |
| `src/ports/ohlcv-repository.ts`                                           | OHLCV 복합 범위 저장·조회 계약                                                    |
| `src/infrastructure/persistence/sqlite/schema.ts`                         | instrument, 시계열, snapshot, run, 상태와 분리 저장소의 DB 제약                   |
| `src/infrastructure/persistence/sqlite/client.ts`                         | schema-aware Drizzle DB를 lazy 생성하고 WAL을 적용하는 Node 경계                  |
| `src/infrastructure/persistence/sqlite/ohlcv-repository.ts`               | Decimal/UTC 보존, 복합 키 upsert와 기간 정렬 조회 구현                            |
| `src/infrastructure/persistence/sqlite/collection-snapshot-repository.ts` | run·상태·최신 결과 transaction과 검증 성공 시 정상 snapshot 교체 구현             |
| `src/infrastructure/providers/yahoo-finance/client.ts`                    | `yahoo-finance2` 호출과 fetch `AbortSignal` 전달을 캡슐화한 서버 client           |
| `src/infrastructure/providers/yahoo-finance/schemas.ts`                   | quote·chart·search 원본 응답의 Zod 신뢰 경계                                      |
| `src/infrastructure/providers/yahoo-finance/mapper.ts`                    | 검증된 Yahoo 값을 Decimal·Temporal 도메인 모델로 변환하고 중복 timestamp를 거부   |
| `src/infrastructure/providers/yahoo-finance/symbol-map.ts`                | 주요 지수, 한국 접미사, 미국 거래소와 USD/KRW 공급원 심볼 매핑                    |
| `src/infrastructure/providers/yahoo-finance/errors.ts`                    | timeout·429·미지원·미존재·비정상 응답을 안정된 사용자 오류로 분류                 |
| `src/infrastructure/providers/yahoo-finance/adapter.ts`                   | 공급원 port 구현, timeout signal 결합과 원본 검증·mapping 조정                    |
| `src/infrastructure/persistence/sqlite/repositories.test.ts`              | clean migration, DB 제약, 복합 upsert와 실패/정상 snapshot 분리 검증              |
| `src/infrastructure/providers/yahoo-finance/adapter.test.ts`              | 여섯 공급원 메서드, malformed 응답, 중복, timeout과 오류 분류 계약 검증           |
| `src/infrastructure/providers/yahoo-finance/symbol-map.test.ts`           | 지수·한국·미국·ETF 심볼 양방향 매핑과 미지원 거래소 검증                          |
| `src/test/fixtures/yahoo/*.json`                                          | 네트워크 없는 Yahoo quote·chart·환율·검색 계약 테스트 원본 fixture                |
| `src/test/server-only.ts`                                                 | Vitest에서 서버 모듈을 검사하되 실제 Next.js의 client import 차단은 유지하는 stub |
| `drizzle/0001_famous_gertrude_yorkes.sql`                                 | M1 DB를 M3 schema로 올리는 생성 migration                                         |

M3의 공급원·DB 구현은 모두 `server-only`이며 Next.js 기본 Node.js runtime을 전제로 한다. 브라우저 계층은
이 파일들을 import할 수 없고 이후 application use case 또는 route handler가 port를 통해 호출한다.

## 11. M4 추가 파일 역할

| 파일                                                    | 역할                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/ports/clock-scheduler.ts`                          | 현재 시각과 절대 시각 예약을 외부 런타임에서 분리하는 port               |
| `src/application/market-data/collection-engine.ts`      | 네 그룹 고정 시각 실행, batch, skip, timeout, 재시도·중단·복구 상태 머신 |
| `src/infrastructure/polling/system-scheduler.ts`        | Node timer와 Temporal을 연결하는 서버 전용 Clock/Scheduler 구현          |
| `src/application/market-data/collection-engine.test.ts` | fake clock으로 0~23초 상태 전이와 그룹 독립성을 검증                     |
| `docs/adr/0004-fixed-time-collection-engine.md`         | 고정 T0, 그룹 격리와 실패·장 재개 정책 결정                              |

## 12. M5 추가 파일 역할과 통찰

| 파일                                                          | 역할                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/contracts/market-overview.ts`                            | 그룹 snapshot, 검색 결과와 종목 시계열의 브라우저 공개 Zod 계약                |
| `src/composition/market-runtime.ts`                           | HTTP 계층과 구체 provider·DB·scheduler 조립을 분리하는 composition root        |
| `src/infrastructure/runtime/market-runtime.ts`                | 적용 설정, Yahoo provider, SQLite snapshot 저장소와 수집 엔진의 lazy 서버 조립 |
| `src/app/api/market/overview/route.ts`                        | 최신 그룹 상태와 서버 적용 조회 주기를 DTO로 반환하는 HTTP adapter             |
| `src/app/api/market/search/route.ts`                          | 검색 입력을 provider use case에 연결하고 안정된 오류로 변환하는 HTTP adapter   |
| `src/app/api/market/instruments/[exchange]/[symbol]/route.ts` | 기간 정책, quote와 OHLCV를 종목 상세 DTO로 조합하는 HTTP adapter               |
| `src/features/market-overview/market-dashboard.tsx`           | 검색·기간·차트 선택 로컬 상태와 서버 Query를 조정하는 시장 화면 경계           |
| `src/components/charts/market-chart.tsx`                      | SVG ECharts와 동등한 텍스트 요약을 함께 제공하는 client-only 표현 컴포넌트     |
| `src/components/app-header.tsx`                               | 세 주요 화면에서 재사용하는 전역 내비게이션 Server Component                   |
| `src/components/data-status/status-badge.tsx`                 | 판별 상태를 아이콘·문구·색으로 함께 표현하는 순수 컴포넌트                     |
| `src/app/providers.tsx`                                       | 최소 client boundary에서 TanStack Query 수명주기를 제공                        |
| `docs/validation/m5-market-overview.png`                      | 고정 E2E 상태의 전체 페이지 시각 증거                                          |
| `design-qa.md`                                                | 기준 샘플, viewport, 비교 결과와 잔여 P3 차이 기록                             |

M5에서 `composition`을 명시적으로 둔 이유는 route handler가 구체 infrastructure를 직접 import하지 않게
하면서도 application 계층이 adapter 조립 책임을 떠안지 않게 하기 위해서다. 이 경계는 실행 시 한 번만
구성되며 브라우저 번들에는 포함되지 않는다. SQLite와 수집 엔진은 module evaluation이 아니라 첫 실제
시장 요청 때 생성한다. 따라서 Next 빌드 worker가 route metadata를 병렬 수집해도 DB WAL 설정을 경쟁하지
않는다.

브라우저 상태는 서버 snapshot과 사용자 입력을 분리한다. Query 캐시가 가격·상태를 교체해도 검색어,
기간과 차트 유형은 컴포넌트 로컬 상태로 남는다. 금액·비율은 계약에서 문자열로 유지하고 표시 경계에서만
Decimal로 해석한다. ECharts에 전달할 때만 시각화 라이브러리 요구 형식인 number로 변환한다.

## 13. M6 추가 파일 역할과 통찰

| 파일                                                                   | 역할                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/ports/user-data-repository.ts`                                    | 관심 종목·포트폴리오의 브라우저 저장 계약과 직렬화 타입       |
| `src/infrastructure/persistence/browser/local-user-data-repository.ts` | version 검증, legacy migration, 손상 복구와 중복 제거 adapter |
| `src/composition/browser-user-data.ts`                                 | client feature와 구체 browser adapter 사이의 조립 경계        |
| `src/app/api/market/fx/route.ts`                                       | USD/KRW 관측을 Decimal 문자열 DTO로 제공하는 서버 경계        |
| `src/features/portfolio-analysis/portfolio-dashboard.tsx`              | 저장 수량과 서버 가격·환율을 결합하는 현재 평가 화면          |

localStorage에는 식별자·표시명·수량만 저장한다. 가격, 환율, 평가금액과 공급원 payload는 화면 진입 때
서버 query로 합성하므로 오래된 시장값이 사용자 데이터처럼 영속되지 않는다. 적용 한도는 삭제 정책이
아니라 신규 쓰기 정책이라서 설정 축소가 기존 사용자 데이터를 자동 삭제하지 않는다.

## 14. M7 추가 파일 역할과 통찰

| 파일                                                                | 역할                                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/domain/portfolios/historical-value.ts`                         | 현재 수량·과거 조정 종가·과거 방향 환율의 일별 추정 가치 순수 계산          |
| `src/domain/backtesting/recommended-portfolios.ts`                  | 네 seed, 비중 검증, 공통 날짜와 월별 리밸런싱 백테스트                      |
| `src/contracts/analysis.ts`                                         | 분석 요청·결과와 추천 카드의 Decimal 문자열 계약                            |
| `src/app/api/portfolio-analysis/route.ts`                           | 브라우저 보유 수량을 저장하지 않고 실행 단위 분석으로 조정하는 HTTP adapter |
| `src/app/api/recommendations/route.ts`                              | 공급원 OHLCV·환율을 KRW 시계열로 정렬해 네 백테스트를 반환                  |
| `src/components/charts/historical-value-chart.tsx`                  | 사용자 보유 수량 기준 과거 추정 가치 SVG 차트와 텍스트 대안                 |
| `src/features/recommended-portfolios/recommendations-dashboard.tsx` | 비교·정렬·가정·복사·보호된 덮어쓰기 UI                                      |

사용자 포트폴리오 분석은 저장 모델을 변경하지 않는 실행 단위 계산이다. 제외 전략은 요청 payload에만
존재하고 localStorage holdings를 수정하지 않는다. 추천 백테스트는 같은 도메인 성과 함수를 재사용하되,
사용자 보유 화면에는 실제 매입가가 없으므로 해당 지표를 노출하지 않아 두 의미를 분리한다.

## 15. 변경 시 점검 순서

1. 제품 의미가 바뀌면 PDD와 관련 ADR을 먼저 갱신한다.
2. 도메인 타입·순수 계산을 만들고 application port/use case를 연결한다.
3. infrastructure adapter와 route handler를 가장 바깥에서 연결한다.
4. 브라우저에는 직렬화된 DTO만 전달하고 서버 객체·Date·DB row를 넘기지 않는다.
5. `pnpm validate`, 관련 migration test, `pnpm test:e2e`, `pnpm build`를 실행한다.
6. 완료 경로와 검증 결과를 `memory-bank/progress.md`에 기록한다.
