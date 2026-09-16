# Stock2 구현 진행 기록

최종 갱신: 2026-09-16

## 단계 상태

| 단계 | 상태 | 요약 |
|---|---|---|
| M0 — 개발 전 검증과 결정 | 완료 | Yahoo 공급원 capability, 이용 제한, 심볼, 기간/간격, 배치와 2초 부하를 실측하고 ADR로 결정함 |
| M1 — 프로젝트 기반과 개발 품질 도구 | 완료 | Next.js 모듈형 모놀리스 기반, 품질 도구, SQLite, 테스트와 계층 경계를 구성함 |
| M2 — 도메인 모델, 계약과 설정 | 대기 | 다음 구현 단계 |
| M3~M9 | 대기 | 선행 단계 완료 후 순차 진행 |

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

관련 요구사항: PDD FR-01~FR-06, FR-12~FR-15, 구현 계획 M0.

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

| 명령 | 결과 |
|---|---|
| `pnpm install --frozen-lockfile` | 통과, lockfile과 설치 상태 일치 |
| `pnpm validate` | 통과: lint, typecheck, Vitest 1/1, 경계 검사 29 modules/22 dependencies |
| `pnpm db:generate` | 통과: 초기 migration 생성 |
| `pnpm db:migrate` | 통과: 로컬 SQLite 적용 |
| `pnpm test:e2e` | 통과: Chrome Playwright 1/1, axe serious/critical 위반 0 |
| `pnpm build` | 통과: `/`와 `/_not-found` 정적 빌드 |

관련 요구사항: 구현 계획 M1 완료 기준. 제품 기능 수용 조건은 M2 이후에 연결한다.

## 다음 개발자 참고

1. M2에서 `src/config/environment.ts`의 raw 환경 입력을 Zod로 검증해 불변 `AppliedConfig`로 바꾼다.
2. 모든 금액·비율 DTO는 Decimal 호환 문자열을 사용하고 날짜는 UTC ISO 8601로 고정한다.
3. Yahoo adapter는 반드시 `src/infrastructure/providers/yahoo-finance` 아래 서버 경계에 두고 브라우저에서
   직접 import하지 않는다.
4. 수집 스케줄러의 T0는 공급원 세션 준비가 끝난 뒤 설정한다. 세션 준비 전 측정의 첫 틱 skip을 회귀
   테스트로 남긴다.
5. 한국어 종목명 검색을 임의 영문 치환으로 구현하지 않는다. 신뢰 가능한 한국어 종목 마스터를 검증한 뒤
   PDD/ADR에 근거를 추가한다.
6. `docs/validation/*.json`은 2026-09-16 단일 환경의 증거이며 SLA가 아니다. M9에서 다시 측정한다.
