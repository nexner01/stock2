# Stock2

한국어 사용자를 위한 시장·종목·포트폴리오 정보 탐색 도구다. 현재 구현 범위는 로컬 MVP이며 매매 신호,
자동 주문, 계좌 연동과 수익 보장을 제공하지 않는다.

## 요구 환경

- Node.js 24 LTS
- pnpm 11
- Google Chrome (Playwright smoke test)

## 설치

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Windows PowerShell에서는 두 번째 명령 대신 다음을 사용한다.

```powershell
Copy-Item .env.example .env.local
```

실제 비밀값과 개인 경로는 `.env.local`에만 두고 커밋하지 않는다.

## 데이터베이스

```bash
pnpm db:generate
pnpm db:migrate
```

기본 SQLite 파일은 `data/stock2.db`이며 Git에서 제외된다.

## 개발 서버

```bash
pnpm dev
```

<http://localhost:3000>에서 확인한다.

## 품질 검사와 테스트

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm boundaries
pnpm test:e2e
pnpm build
```

`pnpm validate`는 lint, typecheck, unit test와 의존 경계 검사를 순서대로 실행한다. `pnpm test:e2e`는
개발 서버를 자동으로 시작하고 Chrome에서 Playwright/axe smoke test를 실행한다.

## 공급원 검증

```bash
pnpm provider:probe
pnpm provider:smoke
pnpm provider:smoke:candidate
pnpm provider:stability
```

네 명령은 실제 Yahoo Finance 네트워크를 사용한다. 기본 스모크는 2초, 운영 후보 스모크는 5초로 각각
1분간 실행하며 안정성 검증은 최대 관심 종목·포트폴리오 구성으로 1시간 실행한다. 결과와 이용 제한은
`docs/provider-capability-matrix.md`에 기록한다. Yahoo 데이터는 로컬 MVP 검증에만 사용하며 공개 재배포
근거로 사용하지 않는다.

프로덕션 서버를 `pnpm start`로 실행한 상태에서 첫 화면과 검색·필터·정렬 목표를 측정한다.

```bash
pnpm performance:local
```

원본 결과는 `docs/validation/app-performance.json`에 기록된다.
