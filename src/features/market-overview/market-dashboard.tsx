"use client";

import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { BarChart3, CandlestickChart, ChevronRight, LineChart, Search, Star } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { MarketChart } from "@/components/charts/market-chart";
import { StatusBadge } from "@/components/data-status/status-badge";
import { Panel } from "@/components/panel";
import { canAdd, LocalUserDataRepository } from "@/composition/browser-user-data";
import {
  instrumentDetailDtoSchema,
  instrumentSearchDtoSchema,
  marketOverviewDtoSchema,
  type InstrumentDetailDto,
  type MarketOverviewDto,
} from "@/contracts";

type SelectedInstrument = { symbol: string; exchange: string };
type Period = "1d" | "5d" | "1m" | "6m" | "1y" | "3y" | "5y" | "7y" | "10y";

const periods: readonly { id: Period; label: string }[] = [
  { id: "1d", label: "1일" },
  { id: "5d", label: "5일" },
  { id: "1m", label: "1개월" },
  { id: "6m", label: "6개월" },
  { id: "1y", label: "1년" },
  { id: "3y", label: "3년" },
  { id: "5y", label: "5년" },
  { id: "7y", label: "7년" },
  { id: "10y", label: "10년" },
];

async function readJson<T>(
  input: RequestInfo,
  schema: { parse(value: unknown): T },
  signal?: AbortSignal,
) {
  const response = await fetch(input, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return schema.parse(await response.json());
}

function signedPercent(value: string) {
  const decimal = new Decimal(value);
  return `${decimal.isPositive() ? "+" : ""}${decimal.toFixed(2)}%`;
}

function direction(value: string) {
  const decimal = new Decimal(value);
  return decimal.isPositive() ? "up" : decimal.isNegative() ? "down" : "flat";
}

function formatPrice(value: string, currency: "KRW" | "USD") {
  const decimal = new Decimal(value);
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(decimal.toNumber());
}

export function MarketDashboard() {
  const [selected, setSelected] = useState<SelectedInstrument>({
    symbol: "AAPL",
    exchange: "XNAS",
  });
  const [period, setPeriod] = useState<Period>("5y");
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const overview = useQuery({
    queryKey: ["market-overview"],
    queryFn: ({ signal }) => readJson("/api/market/overview", marketOverviewDtoSchema, signal),
    refetchInterval: (query) => {
      const data = query.state.data as MarketOverviewDto | undefined;
      return data ? data.pollIntervalSeconds * 1_000 : false;
    },
  });
  const detail = useQuery({
    queryKey: ["instrument-detail", selected.exchange, selected.symbol, period],
    queryFn: ({ signal }) =>
      readJson(
        `/api/market/instruments/${encodeURIComponent(selected.exchange)}/${encodeURIComponent(selected.symbol)}?period=${period}`,
        instrumentDetailDtoSchema,
        signal,
      ),
  });
  const search = useQuery({
    queryKey: ["instrument-search", searchTerm],
    queryFn: ({ signal }) =>
      readJson(
        `/api/market/search?q=${encodeURIComponent(searchTerm)}`,
        instrumentSearchDtoSchema,
        signal,
      ),
    enabled: searchTerm.length > 0,
  });

  const indices = overview.data?.groups.find(({ id }) => id === "indices");
  const popular = overview.data?.groups.find(({ id }) => id === "popular");
  const watchlist = overview.data?.groups.find(({ id }) => id === "watchlist");

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  }

  function selectInstrument(instrument: SelectedInstrument) {
    setSelected(instrument);
    setSearchTerm("");
  }

  return (
    <>
      <AppHeader />
      <main className="market-shell">
        <section className="hero-copy" aria-labelledby="market-title">
          <div>
            <p className="eyebrow">MARKET EXPLORER</p>
            <h1 id="market-title">주식 검색 및 시황</h1>
            <p>시장 흐름과 종목의 가격 이력을 기준 시각·출처와 함께 확인하세요.</p>
          </div>
          <div className="refresh-copy">
            <span className="live-dot" aria-hidden="true" />
            {overview.data
              ? `${overview.data.pollIntervalSeconds}초 자동 갱신`
              : "적용 설정 확인 중"}
          </div>
        </section>

        <Panel className="search-panel" aria-label="종목 검색">
          <form className="stock-search" onSubmit={submitSearch}>
            <Search aria-hidden="true" size={20} />
            <label className="sr-only" htmlFor="stock-search">
              회사명 또는 티커 검색
            </label>
            <input
              id="stock-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="회사명 또는 티커를 검색하세요 (예: 삼성전자, AAPL)"
            />
            <button type="submit">검색</button>
          </form>
          {searchTerm ? (
            <div className="search-results" aria-live="polite">
              {search.isPending ? <p>검색 중…</p> : null}
              {search.isError ? (
                <p role="alert">검색 결과를 불러오지 못했습니다. 다시 시도해 주세요.</p>
              ) : null}
              {search.data?.length === 0 ? <p>일치하는 종목이 없습니다.</p> : null}
              {search.data?.map((item) => (
                <button
                  key={`${item.exchange}:${item.symbol}`}
                  aria-label={`검색 결과 ${item.name} ${item.symbol} 선택`}
                  onClick={() => selectInstrument(item)}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.symbol} · {item.exchange}
                    </small>
                  </span>
                  <span className={`change change--${direction(item.changePercent)}`}>
                    {signedPercent(item.changePercent)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </Panel>

        <section className="section-block" aria-labelledby="indices-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MAJOR INDICES</p>
              <h2 id="indices-title">주요 지수</h2>
            </div>
            {indices ? <StatusBadge status={indices.status} /> : null}
          </div>
          {overview.isError ? <ErrorCard onRetry={() => void overview.refetch()} /> : null}
          <div className="index-grid">
            {(indices?.values ?? []).map((item) => (
              <button
                className="index-card"
                key={`${item.exchange}:${item.symbol}`}
                onClick={() => selectInstrument(item)}
              >
                <span className="index-card__top">
                  <span className="instrument-symbol">{item.symbol.slice(0, 4)}</span>
                  <small>{item.marketStatus === "open" ? "장중" : "장 마감"}</small>
                </span>
                <strong>{item.name}</strong>
                <span className="index-card__price">{formatPrice(item.price, item.currency)}</span>
                <span className={`change change--${direction(item.changePercent)}`}>
                  {signedPercent(item.changePercent)} <span className="sr-only">전일 대비</span>
                </span>
              </button>
            ))}
            {overview.isPending
              ? Array.from({ length: 4 }, (_, index) => (
                  <div
                    className="index-card skeleton"
                    key={index}
                    aria-label="지수 데이터 불러오는 중"
                  />
                ))
              : null}
          </div>
        </section>

        <div className="market-columns">
          <div className="market-main-column">
            <InstrumentPanel
              detail={detail.data}
              isPending={detail.isPending}
              isError={detail.isError}
              period={period}
              chartType={chartType}
              onPeriod={setPeriod}
              onChartType={setChartType}
              onRetry={() => void detail.refetch()}
              watchlistLimit={overview.data?.limits.watchlistMaxSymbols}
            />
            <PopularTable data={popular} onSelect={selectInstrument} />
          </div>
          <aside className="market-side-column" aria-label="시장 보조 정보">
            <Panel className="watchlist-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">WATCHLIST</p>
                  <h2>관심 종목</h2>
                </div>
                <Star aria-hidden="true" size={18} />
              </div>
              {watchlist?.values.length ? (
                watchlist.values.map((item) => (
                  <button
                    className="compact-stock"
                    key={`${item.exchange}:${item.symbol}`}
                    onClick={() => selectInstrument(item)}
                  >
                    <span>
                      <strong>{item.symbol}</strong>
                      <small>{item.name}</small>
                    </span>
                    <span>
                      <strong>{formatPrice(item.price, item.currency)}</strong>
                      <small className={`change change--${direction(item.changePercent)}`}>
                        {signedPercent(item.changePercent)}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <Star aria-hidden="true" size={26} />
                  <strong>관심 종목이 없습니다</strong>
                  <p>종목 상세에서 관심 종목을 추가하면 여기에 표시됩니다.</p>
                </div>
              )}
            </Panel>
            <Panel className="sector-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">MARKET PULSE</p>
                  <h2>인기 종목 흐름</h2>
                </div>
                <BarChart3 aria-hidden="true" size={18} />
              </div>
              {(popular?.values ?? []).slice(0, 4).map((item) => (
                <div className="sector-row" key={`${item.exchange}:${item.symbol}`}>
                  <span>{item.name}</span>
                  <span className={`change change--${direction(item.changePercent)}`}>
                    {signedPercent(item.changePercent)}
                  </span>
                </div>
              ))}
              <p className="panel-note">공급원 수집 결과이며 매매 추천이 아닙니다.</p>
            </Panel>
          </aside>
        </div>
      </main>
    </>
  );
}

function InstrumentPanel({
  detail,
  isPending,
  isError,
  period,
  chartType,
  onPeriod,
  onChartType,
  onRetry,
  watchlistLimit,
}: Readonly<{
  detail: InstrumentDetailDto | undefined;
  isPending: boolean;
  isError: boolean;
  period: Period;
  chartType: "line" | "candle";
  onPeriod(value: Period): void;
  onChartType(value: "line" | "candle"): void;
  onRetry(): void;
  watchlistLimit: number | undefined;
}>) {
  return (
    <Panel className="chart-panel">
      {isPending ? (
        <div className="chart-loading" aria-live="polite">
          종목 시계열을 불러오는 중…
        </div>
      ) : null}
      {isError ? <ErrorCard onRetry={onRetry} /> : null}
      {detail ? (
        <>
          <div className="instrument-summary">
            <div>
              <span className="instrument-symbol">{detail.quote.symbol}</span>
              <h2>{detail.quote.name}</h2>
              <p>
                {detail.quote.exchange} · {detail.quote.currency}
              </p>
              <WatchlistButton detail={detail} limit={watchlistLimit} />
            </div>
            <div className="instrument-price">
              <strong>{formatPrice(detail.quote.price, detail.quote.currency)}</strong>
              <span className={`change change--${direction(detail.quote.changePercent)}`}>
                {signedPercent(detail.quote.changePercent)} 전일 대비
              </span>
            </div>
          </div>
          <div className="chart-controls">
            <div className="segmented" aria-label="조회 기간">
              {periods.map((item) => (
                <button
                  aria-pressed={period === item.id}
                  key={item.id}
                  onClick={() => onPeriod(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="segmented" aria-label="차트 유형">
              <button aria-pressed={chartType === "line"} onClick={() => onChartType("line")}>
                <LineChart size={15} />
                라인
              </button>
              <button aria-pressed={chartType === "candle"} onClick={() => onChartType("candle")}>
                <CandlestickChart size={15} />
                캔들
              </button>
            </div>
          </div>
          {detail.ohlcv.length ? (
            <MarketChart detail={detail} type={chartType} />
          ) : (
            <div className="empty-state">선택한 기간에 표시할 가격 이력이 없습니다.</div>
          )}
          <div className="data-footnote">
            기준 {detail.quote.marketTimestamp.slice(0, 16).replace("T", " ")} UTC · 수집{" "}
            {detail.quote.collectedAt.slice(0, 16).replace("T", " ")} UTC · Yahoo Finance
          </div>
        </>
      ) : null}
    </Panel>
  );
}

function WatchlistButton({
  detail,
  limit,
}: Readonly<{ detail: InstrumentDetailDto; limit: number | undefined }>) {
  const [included, setIncluded] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const data = new LocalUserDataRepository(localStorage).load();
      setIncluded(
        data.watchlist.some(
          (item) => item.symbol === detail.quote.symbol && item.exchange === detail.quote.exchange,
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [detail.quote.exchange, detail.quote.symbol]);

  function toggle() {
    const repository = new LocalUserDataRepository(localStorage);
    const data = repository.load();
    if (included) {
      repository.save({
        ...data,
        watchlist: data.watchlist.filter(
          (item) => item.symbol !== detail.quote.symbol || item.exchange !== detail.quote.exchange,
        ),
      });
      setIncluded(false);
      return;
    }
    if (!limit || !canAdd(data.watchlist.length, limit)) return;
    if (
      !data.watchlist.length &&
      !data.portfolios.length &&
      !window.confirm(
        "관심 종목은 이 브라우저 기기에만 저장됩니다. 브라우저 데이터 삭제 시 복구할 수 없습니다. 저장할까요?",
      )
    )
      return;
    repository.save({
      ...data,
      watchlist: [
        ...data.watchlist,
        { symbol: detail.quote.symbol, exchange: detail.quote.exchange, name: detail.quote.name },
      ],
    });
    setIncluded(true);
  }

  return (
    <button className="watchlist-action" type="button" aria-pressed={included} onClick={toggle}>
      <Star size={14} fill={included ? "currentColor" : "none"} />
      {included ? "관심 종목 제거" : "관심 종목 추가"}
    </button>
  );
}

function PopularTable({
  data,
  onSelect,
}: Readonly<{
  data: MarketOverviewDto["groups"][number] | undefined;
  onSelect(value: SelectedInstrument): void;
}>) {
  return (
    <Panel className="table-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">POPULAR STOCKS</p>
          <h2>인기 종목</h2>
        </div>
        {data ? <StatusBadge status={data.status} /> : null}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">종목</th>
              <th scope="col">현재가</th>
              <th scope="col">등락률</th>
              <th scope="col">시장</th>
              <th scope="col">
                <span className="sr-only">상세</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(data?.values ?? []).map((item) => (
              <tr key={`${item.exchange}:${item.symbol}`}>
                <th scope="row">
                  <strong>{item.name}</strong>
                  <small>{item.symbol}</small>
                </th>
                <td>{formatPrice(item.price, item.currency)}</td>
                <td>
                  <span className={`change change--${direction(item.changePercent)}`}>
                    {signedPercent(item.changePercent)}
                  </span>
                </td>
                <td>{item.marketStatus === "open" ? "장중" : "장 마감"}</td>
                <td>
                  <button aria-label={`${item.name} 상세 보기`} onClick={() => onSelect(item)}>
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ErrorCard({ onRetry }: Readonly<{ onRetry(): void }>) {
  return (
    <div className="error-state" role="alert">
      <div>
        <strong>시장 데이터를 불러오지 못했습니다.</strong>
        <p>현재 화면의 입력은 유지됩니다. 연결을 확인하고 다시 시도해 주세요.</p>
      </div>
      <button onClick={onRetry}>다시 시도</button>
    </div>
  );
}
