# ADR 0001: Next.js 모듈형 모놀리스

- 상태: 승인
- 결정일: 2026-09-16
- 관련 문서: PDD v0.2.9, `AGENTS.md`, 구현 계획 M0

## 문제

Stock2는 시장 데이터 수집, 로컬 SQLite 저장, 순수 분석 계산, 브라우저 상호작용을 한 로컬 제품에서
제공해야 한다. 동시에 Yahoo Finance와 데이터베이스 코드는 브라우저 번들에서 분리하고, 향후 서버와
클라이언트를 분리할 수 있는 계약 경계를 보존해야 한다.

## 결정

Next.js App Router 기반 모듈형 모놀리스를 사용한다. 실행 단위는 하나지만 의존 방향은 아래처럼 제한한다.

```text
app/features -> application -> domain
             -> contracts
application  -> ports <- infrastructure
```

- `domain`은 프레임워크와 외부 I/O를 모른다.
- `application`은 유스케이스와 포트만 조정한다.
- `infrastructure`는 Yahoo Finance, SQLite, 로깅과 스케줄러를 구현하며 `server-only`로 보호한다.
- `app` route handler는 입력·출력 변환만 담당한다.
- 브라우저는 서버 계약 DTO와 브라우저 로컬 저장소 어댑터만 사용한다.
- MVP는 기본 Node.js 런타임을 사용한다. SQLite와 서버 전용 패키지 때문에 Edge 런타임은 사용하지 않는다.
- 의존성 순환과 금지된 계층 import는 정적 검사로 차단한다.

## 검토한 대안

- 별도 API 서버: MVP에서 계약 중복과 운영 복잡도가 증가하므로 보류한다.
- 브라우저의 Yahoo Finance 직접 호출: CORS/쿠키 제약과 비밀·계약 경계 위반 때문에 제외한다.
- 처음부터 분산 서비스: 로컬 MVP의 범위를 벗어나며 장애 지점만 늘리므로 제외한다.

## 결과

서버/클라이언트 분리는 포트와 DTO를 유지한 채 배포 경계만 이동할 수 있다. 대신 계층 규칙을 지속적으로
검사해야 하며, 서버 전용 모듈의 공개 API를 명확히 관리해야 한다.
