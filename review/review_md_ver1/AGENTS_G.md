PDD v0.2.9의 핵심 요건(2초 고정 주기 스케줄링, 4대 데이터 그룹 독립 호출, 부분 화면 갱신, 엄격한 설정 폴백 및 계산 정합성)을 완벽히 충족하면서 유지 보수가 편리하도록 설계한 **`AGENTS.md`** 명세서입니다.

---

### 💡 실생활 비유로 보는 아키텍처

> 이번 시스템 구조는 **"고급 호텔의 룸서비스 주방(FastAPI)과 스마트 객실 태블릿(React)"**의 관계와 같습니다.
>
> - **주방(백엔드 스케줄러)**: 메인 셰프는 2초 간격 알람 시계에 맞춰 지수, 인기 종목, 관심 종목, 포트폴리오 음식을 각각 다른 화구(비동기 독립 태스크)에서 조리합니다. 샐러드가 늦게 나온다고(5초 타임아웃) 스테이크 굽는 것을 멈추지 않습니다.
>
> - **객실 태블릿(프론트엔드)**: 손님이 포트폴리오 수량을 입력하거나 화면을 스크롤하는 도중 새 음식이 도착해도 화면 전체를 깜빡거리며 새로고침하지 않고, 접시(해당 데이터 영역)만 조용히 갈아 끼웁니다(부분 화면 갱신).

---

### 기술 스택 선정 요약

| 계층        | 선정 기술                  | 선정 사유 (PDD 요구사항 매핑)                |
| ----------- | -------------------------- | -------------------------------------------- |
| **Backend** | **Python 3.12+ / FastAPI** | • 4개 그룹의 비동기 병렬 I/O 처리(`asyncio`) |

<br>

<br>• Pydantic v2 기반 엄격한 환경변수 검증 및 폴백 처리 (`FR-15`)

<br>

<br>• 고정 시각 스케줄러 원점 계산 및 회차 건너뛰기 제어 용이 (`FR-12`)

|
| **Frontend** | **React 18+ (Vite) / TypeScript** | • 전체 화면 재실행 없이 부분 렌더링 완벽 보장 (`FR-16`)

<br>

<br>• 사용자 입력 폼 포커스 및 스크롤 위치 영구 보존 (`AC-16`)

|
| **State / Sync** | **TanStack Query (React Query)** | • 서버 설정값(`poll_interval`)과 클라이언트 폴링 주기 완벽 동기화 (`FR-13`)

<br>

<br>• 그룹별 독립 쿼리 키 기반 상태 및 에러 격리 (`FR-14`)

|
| **Charts** | **Lightweight Charts & Recharts** | • 200% 확대 대응 및 반응형 벡터 품질 보장 (`섹션 10`)

<br>

<br>• 초당 수십 회 갱신에도 버벅임 없는 Canvas/SVG 하이브리드 렌더링 |
| **Calculation** | **NumPy / Pandas** | • 10년 일별 수익률, CAGR, 연환산 변동성, MDD 벡터화 연산 (`섹션 7`)

<br>

<br>• 결측치 및 한/미 휴장일 Forward-fill(`ffill`) 보정 (`7.6`)

|
| **Storage** | **Browser LocalStorage** | • MVP 로컬 저장소 원칙 및 비파괴적 한도 관리 (`FR-07`, `FR-08`, `FR-15`)

|

---

### `AGENTS.md` 전문

````markdown
# AGENTS.md — Stock2 Dashboard Development Guide

이 문서는 AI 코딩 에이전트 및 개발자가 PDD v0.2.9 규격을 준수하여 시스템을 구현, 유지 보수, 확장할 때 따라야 하는 절대 규칙입니다.

---

## 1. 기술 스택 (Tech Stack)

### Backend

- **Runtime**: Python 3.12+
- **Framework**: FastAPI (ASGI 비동기 서버)
- **Settings & Validation**: Pydantic Settings v2
- **Data Fetching**: HTTPX (비동기 HTTP 클라이언트, 그룹별 타임아웃 5초 바인딩)
- **Financial Analytics**: Pandas, NumPy (배열 벡터화 연산)
- **External Adapter**: Yahoo Finance REST Wrapper (브라우저 직접 호출 절대 금지)

### Frontend

- **Core**: React 18+ / TypeScript / Vite
- **Data Synchronization**: TanStack Query v5 (React Query)
- **Charts**:
  - 시계열/캔들/라인 차트: TradingView Lightweight Charts (고성능 Canvas/Vector)
  - 포트폴리오 비중: Recharts (SVG 기반, 200% 확대 대응)
- **Styling**: Tailwind CSS (Pretendard 폰트 기본 적용)
- **State & Local Storage**: Zustand (로컬 상태) + Web LocalStorage API

---

## 2. 프로젝트 디렉토리 구조 (Layered Architecture)

유지 보수성과 관심사 분리(SoC)를 위해 코드는 도메인 중심 계층형 구조를 엄격히 준수합니다.

```text
stock2-dashboard/
├── backend/
│   ├── app/
│   │   ├── api/                  # API 라우터 (FastAPI 엔드포인트)
│   │   │   ├── deps.py           # 의존성 주입 (설정, 서비스 등)
│   │   │   └── v1/
│   │   │       ├── endpoints/    # 지수, 인기, 검색, 환율 엔드포인트
│   │   │       └── router.py
│   │   ├── core/                 # 시스템 핵심 설정 및 공통 유틸
│   │   │   ├── config.py         # Pydantic 기반 환경변수 검증 및 보정/폴백
│   │   │   └── logging.py        # 보정 사유 및 시스템 로거
│   │   ├── domain/               # 순수 비즈니스 로직 (외부 의존성 없음)
│   │   │   ├── calculations.py   # 일별 수익률, CAGR, MDD, 변동성 계산 공식
│   │   │   └── models.py         # OHLCV, 스냅샷, 시장 상태 스키마
│   │   ├── providers/            # 외부 데이터 공급원 어댑터 계층
│   │   │   ├── base.py           # Provider 추상 인터페이스
│   │   │   └── yahoo_adapter.py  # Yahoo Finance 연동 및 심볼 매핑 (DBC 등)
│   │   ├── services/             # 오케스트레이션 및 백그라운드 스케줄러
│   │   │   ├── scheduler.py      # 고정 시각 계산, 회차 건너뛰기, 스케줄러
│   │   │   ├── polling_group.py  # 4대 그룹별 비동기 작업 격리 및 3회 재시도 머신
│   │   │   └── market_watcher.py # 장 마감/재개 감지 및 T0 원점 재설정
│   │   └── main.py               # FastAPI 앱 진입점
│   └── tests/                    # 단위, 스모크, 부하 검증 테스트
├── frontend/
│   ├── src/
│   │   ├── api/                  # 백엔드 API 클라이언트 (Axios / Fetch)
│   │   ├── components/           # UI 컴포넌트
│   │   │   ├── charts/           # 캔들, 라인, 원형 벡터 차트
│   │   │   ├── common/           # 배지, 모달, 포커스 제어 입력 필드
│   │   │   └── dashboard/        # 4대 그룹별 분리형 카드 (부분 갱신 단위)
│   │   ├── hooks/                # 데이터 동기화 커스텀 훅
│   │   │   ├── usePollingGroup.ts# 그룹별 React Query 폴링 및 재시도 훅
│   │   │   └── usePortfolio.ts   # LocalStorage 연동 및 비파괴 저장 훅
│   │   ├── stores/               # 전역 UI 상태 (선택 탭, 검색어 필터)
│   │   ├── types/                # TypeScript 도메인 인터페이스
│   │   └── App.tsx               # 탭 레이아웃 및 전체 에러 바운더리
│   └── index.html
├── AGENTS.md
└── README.md
```
````

---

## 3. 유지 보수 및 아키텍처 규칙

### 규칙 1: 설정 검증 및 폴백 원칙 (Fail-Safe & Centralized Settings)

- 모든 시스템 파라미터는 `backend/app/core/config.py`에서 단일 관리한다.
- `realtime.poll_interval_seconds`(기본 2), `provider.request_timeout_seconds`(기본 5) 등 모든 값은 부팅 시 검증한다.

- 비정상 값(비숫자, 1 미만 등) 주입 시 즉시 중단하지 않고 기본값으로 자동 보정하며, 보정 내역(키, 입력값, 적용값, 사유)을 개발 로그에 반드시 기록한다 (`FR-12`, `FR-15`).

- `provider.batch_size`가 `provider.max_symbols_per_request`를 초과하면 즉시 최대 심볼 수 이하로 다운스케일 보정한다 (`FR-15`).

### 규칙 2: 고정 시각 스케줄링 및 지연 격리 (Fixed-Tick Engine)

- 자동 주기 스케줄러는 `수집 시작 시각 + (적용 주기 × n)` 고정 틱을 기준으로 동작한다 (`FR-12`).

- 이전 요청이 끝나지 않은 그룹은 **해당 그룹의 이번 회차만 건너뛰며(Skip)**, 건너뛰기 카운터를 1 올린다 (`FR-12`, `FR-14`).

- 타임아웃(기본 5초) 발생 시 스케줄을 재정렬하지 않고, 종료 시점 이후 처음 도래하는 고정 시각에 다음 요청을 실행한다 (`FR-12`, `AC-19`).

- 장 마감 상태에서 장중 전환을 감지한 경우, 감지 시점을 새로운 $T_0$(원점)으로 즉시 재설정하되 지난 회차는 절대 소급 실행하지 않는다 (`FR-12`, `AC-29`).

### 규칙 3: 4대 데이터 그룹의 완전한 독립성 (Group Fault Isolation)

- `주요 지수`, `인기 종목`, `관심 종목`, `포트폴리오 종목`은 서로 다른 비동기 태스크(`asyncio.gather` 또는 개별 태스크)로 분리한다 (`FR-14`).

- 한 그룹이 5초 타임아웃 또는 실패해도 다른 그룹의 정상 갱신을 차단하거나 상태를 오염시키지 않는다 (`FR-14`, `AC-15`).

- 자동 조회의 3회 재시도 실패 카운터는 그룹별로 독립 유지하며, 사용자의 단건 '일반 조회(검색, 시계열 상세)' 실패와 절대 섞지 않는다 (`FR-12`, `AC-28`).

- 그룹이 `실패` 상태로 전환되면 해당 그룹에만 `다시 시도` 버튼을 제공하며, 복구 시 타 그룹과 화면 상태를 온전히 보존한다 (`FR-12`, `AC-22`).

### 규칙 4: 순수 함수 기반 금융 계산 (Deterministic Analytics)

- `domain/calculations.py`의 모든 연산(수익률, CAGR, 변동성, MDD)은 부수 효과(Side-effect)가 없는 순수 함수로 작성한다.
- 10년 미상장 종목은 **절대 0원으로 계산하지 않는다.** 공통 데이터 시작일(Common Start Date) 이후 구간만 계산하거나 UI 제외 옵션과 연동한다 (`FR-09`, `FR-10`).

- 한/미 휴장일 불일치로 인한 환율 결측치는 직전 유효 거래일 환율을 Forward-fill(`ffill`)하여 계산하며 미래 데이터 누수를 방지한다 (`7.6`, `AC-10`).

- All Weather 포트폴리오의 원자재 ETF는 `DBC`를 강제한다 (`FR-11`).

### 규칙 5: 프론트엔드 비파괴 및 부분 렌더링 (State-Preserving UI)

- 실시간 데이터 도착 시 전체 페이지를 리렌더링하지 않는다. React 컴포넌트는 `React.memo`와 세분화된 React Query 훅으로 변경된 텍스트/차트 영역만 부분 갱신한다 (`FR-16`).

- 부분 갱신 중 사용자의 입력 폼 포커스, 텍스트 커서 위치, 스크롤 위치, 탭 선택 상태를 절대 초기화하지 않는다 (`FR-16`, `AC-16`).

- LocalStorage 저장 한도(관심 20개, 포트폴리오 10개) 축소 설정이 내려와도 기존에 저장된 초과 종목을 자동 삭제하지 않는다 (조회/삭제 허용, 신규 추가만 차단) (`FR-15`, `AC-27`).

---

## 4. 검증 및 테스트 규칙 (Verification Mandates)

모든 코드 수정 후 아래 테스트 항목을 통과해야 배포 및 PR 병합이 허용됩니다.

1. **스모크 부하 테스트 (`AC-15`)**:

- `적용 자동 조회 주기` 환경에서 4개 그룹을 1분간 연속 호출하여 응답 지연 및 건너뛰기가 0회여야 한다.

2. **타임아웃 엣지 케이스 (`AC-22`)**:

- 타임아웃 5초 설정 시 0초, 6초, 12초, 18초 호출 후 정확히 23초에 해당 그룹이 `실패` 상태로 전환되는지 Mock 타이머로 검증한다.

3. **상태 분리 테스트 (`AC-28`)**:

- 일반 종목 검색 404/500 에러 발생 시 자동 주기 조회의 실패 카운터가 증가하지 않음을 증명한다.

4. **접근성 및 고해상도 확대 (`섹션 10`)**:

- 브라우저를 200% 확대한 상태에서 차트 선이 깨지지 않고 모든 모달/테이블이 가로 스크롤을 통해 정상 열람되는지 확인한다.

```

```
