# ADR 0002: Yahoo Finance 서버 어댑터

- 상태: 조건부 승인
- 결정일: 2026-09-16
- 검증 버전: `yahoo-finance2` 4.0.2
- 관련 문서: PDD FR-01~~FR-06, FR-12~~FR-15, 구현 계획 M0

## 문제

초기 공급원이 한국·미국 시장, 주요 지수, 추천 ETF, 환율, OHLCV와 2초 조회 주기를 실제로 지원하는지
확인해야 한다. 지원하지 않는 데이터는 대체 값으로 숨길 수 없다.

## 결정

로컬 MVP의 초기 공급원으로 Yahoo Finance를 서버 어댑터 뒤에서 사용한다. 직접 비공개 엔드포인트를
고정하지 않고 `yahoo-finance2`의 검증·쿠키·요청 큐를 사용한다.

- 지수 심볼은 `^KS11`, `^KQ11`, `^IXIC`, `^GSPC`를 사용한다.
- 한국 종목은 KRX 코드에 `.KS`, KOSDAQ 코드에 `.KQ`를 붙인다.
- USD/KRW 환율은 `KRW=X`를 사용하며 도메인 mapper에서 방향과 단위를 명시한다.
- 추천 ETF는 PDD의 `VTI`, `BND`, `MTUM`, `TLT`, `IEF`, `DBC`, `GLD`, `IJS`, `SHY`를 그대로 사용한다.
- 실시간 quote의 애플리케이션 기본 배치는 10개로 유지한다. 4·10·20개 요청이 모두 성공했지만 Yahoo가
  공식 한도를 공개하지 않으므로 20개 성공을 계약상 보장으로 해석하지 않는다.
- 공급원 세션을 수집 원점 전에 초기화한다. 2026-09-17 재측정에서 2초 고정 주기는 모든 그룹이
  30/30회, 5초 후보 주기는 12/12회 성공했고 timeout, delayed, skip, HTTP 429가 모두 0회였다. 기본값은
  2초를 유지하고 5초는 외부 환경 변화 시 명시적으로 적용할 수 있는 후보로 남긴다.
- 한국어 회사명 직접 검색은 검증에서 거부됐다. 초기 검색은 티커·영문명을 지원하고, 한국어 이름 검색은
  검증된 별칭/종목 마스터 인덱스를 별도로 확보하기 전까지 비지원 사유를 명시한다.

## 이용 조건과 제품 경계

Yahoo는 Finance 정보를 재배포하지 말라고 명시하며, `yahoo-finance2`도 Yahoo의 공식 API가 아니고
가용성과 계약 안정성을 보장하지 않는다고 설명한다. 따라서 이 결정은 개인 로컬 MVP 검증에만 적용한다.
외부 공개 배포, 제3자 제공 또는 상용 사용 전에는 데이터 라이선스 검토와 정식 공급원 선정이 필요하다.

한국거래소와 KOSDAQ 데이터는 Yahoo 안내상 20분 지연이다. UI는 이를 실시간 시세로 오인시키지 않고
공급원 기준 시각과 수집 완료 시각, 지연 상태를 표시해야 한다. Nasdaq Global Index와 S&P 지수는 Yahoo
안내상 실시간이지만 응답 메타의 시각을 최종 기준으로 삼는다.

## 근거

- Yahoo Finance 시장 범위·지연·재배포 제한: <https://help.yahoo.com/kb/SLN2310.html>
- Yahoo 조정 종가 정의: <https://help.yahoo.com/kb/SLN28256.html>
- Yahoo 과거 데이터와 라이선스별 다운로드 제한: <https://help.yahoo.com/kb/sln2311.html>
- `yahoo-finance2` 비공식 API 및 서버 실행 제약: <https://github.com/gadicc/yahoo-finance2>
- 검증 결과: `docs/validation/provider-probe.json`, `docs/validation/provider-smoke.json`,
  `docs/validation/provider-smoke-candidate.json`, `docs/validation/provider-stability.json`

## 후속 조건

- M3에서 원본 응답 Zod 검증, 명시적 도메인 mapper, 심볼 매핑 격리, AbortSignal 타임아웃과 안정된 오류
  분류를 구현했다. 계약 테스트는 고정 fixture만 사용하며 실 네트워크에 의존하지 않는다.
- 배포 범위가 로컬을 벗어나면 이 ADR을 재검토한다.
- M9에서 최대 구성 2초 주기의 1시간 안정성, 429, 재연결과 프로세스 메모리를 실측하고 결과를 검증
  산출물에 고정했다. 주요 지수에서 timeout 1회와 skip 2회 뒤 연결 회복 1회가 있었고, 다른 세 그룹은
  1,800/1,800회 성공했으며 429와 처리되지 않은 예외는 0회였다. 이 측정은 공급원 SLA가 아니므로 외부
  공개 전 공급원 결정은 다시 검토한다.
