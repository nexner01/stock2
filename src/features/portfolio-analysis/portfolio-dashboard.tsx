"use client";

import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { BriefcaseBusiness, HardDrive, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { HistoricalValueChart } from "@/components/charts/historical-value-chart";
import { Panel } from "@/components/panel";
import { canAdd, LocalUserDataRepository } from "@/composition/browser-user-data";
import {
  exchangeRateDtoSchema,
  instrumentDetailDtoSchema,
  marketOverviewDtoSchema,
  portfolioAnalysisDtoSchema,
} from "@/contracts";
import type { StoredHolding, UserData } from "@/ports";

async function readJson<T>(
  url: string,
  schema: { parse(value: unknown): T },
  signal?: AbortSignal,
) {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return schema.parse(await response.json());
}

const initial: UserData = { version: 1, watchlist: [], portfolios: [], activePortfolioId: null };

export function PortfolioDashboard() {
  const [data, setData] = useState<UserData>(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState("XNAS");
  const [quantity, setQuantity] = useState("");
  const [analysisPeriod, setAnalysisPeriod] = useState("5y");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setData(new LocalUserDataRepository(localStorage).load());
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const overview = useQuery({
    queryKey: ["market-overview"],
    queryFn: ({ signal }) => readJson("/api/market/overview", marketOverviewDtoSchema, signal),
  });
  const fx = useQuery({
    queryKey: ["usd-krw"],
    queryFn: ({ signal }) => readJson("/api/market/fx", exchangeRateDtoSchema, signal),
  });
  const active =
    data.portfolios.find(({ id }) => id === data.activePortfolioId) ?? data.portfolios[0];
  const holdings = active?.holdings ?? [];
  const analysis = useMutation({
    mutationFn: async (strategy: "common-period" | "exclude-short-history" | "cancel") => {
      const response = await fetch("/api/portfolio-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period: analysisPeriod,
          strategy,
          holdings: holdings.map(({ symbol, exchange, quantity }) => ({
            symbol,
            exchange,
            quantity,
          })),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return portfolioAnalysisDtoSchema.parse(await response.json());
    },
  });
  const detailQueries = useQueries({
    queries: holdings.map((holding) => ({
      queryKey: ["portfolio-quote", holding.exchange, holding.symbol],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readJson(
          `/api/market/instruments/${holding.exchange}/${holding.symbol}?period=1d`,
          instrumentDetailDtoSchema,
          signal,
        ),
      retry: false,
    })),
  });
  const rows = holdings.map((holding, index) => {
    const quote = detailQueries[index]?.data?.quote;
    const value = quote
      ? new Decimal(holding.quantity)
          .mul(quote.price)
          .mul(quote.currency === "USD" ? (fx.data?.rate ?? "0") : "1")
      : null;
    return { holding, quote, value, failed: detailQueries[index]?.isError ?? false };
  });
  const total = rows.reduce((sum, row) => (row.value ? sum.plus(row.value) : sum), new Decimal(0));

  function persist(next: UserData, firstSave = false) {
    if (
      firstSave &&
      !window.confirm(
        "포트폴리오는 이 브라우저 기기에만 저장됩니다. 브라우저 데이터 삭제 시 복구할 수 없습니다. 저장할까요?",
      )
    )
      return false;
    new LocalUserDataRepository(localStorage).save(next);
    setData(next);
    return true;
  }

  function addHolding(event: FormEvent) {
    event.preventDefault();
    setError("");
    let parsedQuantity: Decimal;
    try {
      parsedQuantity = new Decimal(quantity);
    } catch {
      setError("수량은 0보다 큰 숫자로 입력해 주세요.");
      return;
    }
    if (!parsedQuantity.isPositive()) {
      setError("수량은 0보다 커야 합니다.");
      return;
    }
    const limit = overview.data?.limits.portfolioMaxSymbols;
    if (!limit) {
      setError("적용 저장 한도를 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    if (!canAdd(holdings.length, limit)) {
      setError(
        `적용 한도 ${limit}개를 초과해 새 종목을 추가할 수 없습니다. 기존 종목은 유지됩니다.`,
      );
      return;
    }
    const normalized = {
      symbol: symbol.trim().toUpperCase(),
      exchange: exchange.trim().toUpperCase(),
    };
    if (!normalized.symbol || !normalized.exchange) {
      setError("티커와 거래소를 입력해 주세요.");
      return;
    }
    if (
      holdings.some(
        (item) => item.symbol === normalized.symbol && item.exchange === normalized.exchange,
      )
    ) {
      setError("이미 같은 거래소의 종목이 있습니다.");
      return;
    }
    const holding: StoredHolding = {
      ...normalized,
      name: normalized.symbol,
      quantity: parsedQuantity.toString(),
    };
    const portfolio = active ?? { id: crypto.randomUUID(), name: "내 포트폴리오", holdings: [] };
    const nextPortfolio = { ...portfolio, holdings: [...portfolio.holdings, holding] };
    const next: UserData = {
      ...data,
      portfolios: active
        ? data.portfolios.map((item) => (item.id === active.id ? nextPortfolio : item))
        : [nextPortfolio],
      activePortfolioId: portfolio.id,
    };
    if (persist(next, data.portfolios.length === 0 && data.watchlist.length === 0)) {
      setSymbol("");
      setQuantity("");
    }
  }

  function removeHolding(target: StoredHolding) {
    if (!active) return;
    persist({
      ...data,
      portfolios: data.portfolios.map((portfolio) =>
        portfolio.id === active.id
          ? {
              ...portfolio,
              holdings: portfolio.holdings.filter(
                (item) => item.symbol !== target.symbol || item.exchange !== target.exchange,
              ),
            }
          : portfolio,
      ),
    });
  }

  function clearAll() {
    if (
      !window.confirm(
        "저장된 포트폴리오를 모두 삭제합니다. 이 작업은 복구할 수 없습니다. 계속할까요?",
      )
    )
      return;
    new LocalUserDataRepository(localStorage).clear();
    setData(initial);
  }

  const composition = useMemo(
    () =>
      rows
        .filter((row) => row.value)
        .map((row) => ({
          ...row,
          weight: total.isZero() ? new Decimal(0) : row.value!.div(total).mul(100),
        })),
    [rows, total],
  );

  return (
    <>
      <AppHeader active="portfolio" />
      <main className="market-shell portfolio-shell">
        <Panel className="portfolio-hero">
          <div>
            <p className="eyebrow">PORTFOLIO</p>
            <h1>내 포트폴리오 분석</h1>
            <p>현재 보유 수량과 최신 가격·환율을 기준으로 원화 평가금액을 확인합니다.</p>
          </div>
          <div className="portfolio-total">
            <small>총 보유 평가금액</small>
            <strong>{formatKrw(total)}</strong>
            <span>
              <HardDrive size={13} /> 이 기기에만 저장됨
            </span>
          </div>
        </Panel>
        <div className="portfolio-layout">
          <Panel className="holdings-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">HOLDINGS</p>
                <h2>보유 종목 및 수량</h2>
              </div>
              <BriefcaseBusiness size={18} />
            </div>
            <form className="holding-form" onSubmit={addHolding}>
              <label>
                티커
                <input
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value)}
                  placeholder="AAPL"
                />
              </label>
              <label>
                거래소
                <select value={exchange} onChange={(event) => setExchange(event.target.value)}>
                  <option>XNAS</option>
                  <option>XNYS</option>
                  <option>XKRX</option>
                  <option>XKOS</option>
                </select>
              </label>
              <label>
                보유 수량
                <input
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="1.5"
                  aria-describedby="holding-error"
                />
              </label>
              <button type="submit">
                <Plus size={15} />
                추가
              </button>
            </form>
            {error ? (
              <p className="field-error" id="holding-error" role="alert">
                {error}
              </p>
            ) : null}
            {!ready ? <p aria-live="polite">저장 데이터를 확인하는 중…</p> : null}
            {ready && !holdings.length ? (
              <div className="empty-state">
                <BriefcaseBusiness size={28} />
                <strong>보유 종목이 없습니다</strong>
                <p>티커, 거래소와 0보다 큰 수량을 입력해 첫 종목을 추가하세요.</p>
              </div>
            ) : null}
            <div className="holding-list">
              {rows.map(({ holding, quote, value, failed }) => (
                <article key={`${holding.exchange}:${holding.symbol}`} className="holding-card">
                  <div>
                    <span className="instrument-symbol">{holding.exchange}</span>
                    <strong>{holding.name}</strong>
                    <small>
                      {holding.symbol} · {holding.quantity}주
                    </small>
                  </div>
                  <div>
                    <strong>{value ? formatKrw(value) : "계산 대기"}</strong>
                    <small>
                      {failed
                        ? "가격 조회 실패 · 다른 종목 계산은 유지"
                        : quote
                          ? `${quote.currency} ${quote.price} · ${quote.marketTimestamp.slice(0, 10)}`
                          : "가격 조회 중"}
                    </small>
                    <button
                      onClick={() => removeHolding(holding)}
                      aria-label={`${holding.symbol} 삭제`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {data.portfolios.length ? (
              <button className="danger-button" onClick={clearAll}>
                <Trash2 size={15} />
                전체 초기화
              </button>
            ) : null}
          </Panel>
          <div className="portfolio-main">
            <div className="metric-grid">
              <Panel>
                <small>총 평가금액</small>
                <strong>{formatKrw(total)}</strong>
              </Panel>
              <Panel>
                <small>구성 종목</small>
                <strong>{holdings.length}개</strong>
              </Panel>
              <Panel>
                <small>USD/KRW</small>
                <strong>{fx.data?.rate ?? "조회 중"}</strong>
              </Panel>
            </div>
            <Panel className="allocation-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">ALLOCATION</p>
                  <h2>현재 평가금액 구성</h2>
                </div>
              </div>
              {fx.isError ? (
                <div className="inline-warning">
                  <ShieldAlert size={16} />
                  환율 조회 실패로 USD 종목 평가금액을 계산하지 못했습니다.
                </div>
              ) : null}
              <div className="allocation-bars">
                {composition.map(({ holding, value, weight }) => (
                  <div key={`${holding.exchange}:${holding.symbol}`}>
                    <div>
                      <strong>{holding.symbol}</strong>
                      <span>
                        {formatKrw(value!)} · {weight.toFixed(1)}%
                      </span>
                    </div>
                    <span>
                      <i style={{ width: `${weight.toFixed(2)}%` }} />
                    </span>
                  </div>
                ))}
              </div>
              <p className="panel-note">
                평가금액은 현재 수량 × 최신 가격 × 해당 통화 환율입니다. 실제 매입 수익률이
                아닙니다.
              </p>
            </Panel>
            <Panel className="analysis-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">HISTORICAL ESTIMATE</p>
                  <h2>현재 보유 수량 기준 과거 추정 가치</h2>
                </div>
              </div>
              <p className="panel-note">
                현재 수량 × 해당 일 조정 종가 × 해당 일의 과거 유효 환율입니다. 실제 매입가·현금
                흐름을 반영한 실제 수익률이 아닙니다.
              </p>
              <div className="analysis-controls">
                <div className="segmented">
                  {(["6m", "1y", "3y", "5y", "7y", "10y"] as const).map((period) => (
                    <button
                      key={period}
                      aria-pressed={analysisPeriod === period}
                      onClick={() => setAnalysisPeriod(period)}
                    >
                      {period === "6m" ? "6개월" : period.replace("y", "년")}
                    </button>
                  ))}
                </div>
                <button
                  disabled={!holdings.length || analysis.isPending}
                  onClick={() => analysis.mutate("common-period")}
                >
                  {analysis.isPending ? "분석 중…" : "분석 실행"}
                </button>
              </div>
              {analysis.isError ? (
                <div className="error-state" role="alert">
                  분석 데이터를 불러오지 못했습니다. 저장된 입력은 유지됩니다.
                </div>
              ) : null}
              {analysis.data?.affected.length ? (
                <div className="analysis-choice">
                  <strong>
                    요청 기간보다 이력이 짧은 종목:{" "}
                    {analysis.data.affected.map(({ symbol }) => symbol).join(", ")}
                  </strong>
                  <p>
                    현재 실제 시작일은 {analysis.data.actualStart}입니다. 모든 종목을 유지하거나
                    짧은 종목을 이번 실행에서만 제외할 수 있습니다.
                  </p>
                  <button onClick={() => analysis.mutate("common-period")}>
                    공통 기간으로 분석
                  </button>
                  <button onClick={() => analysis.mutate("exclude-short-history")}>
                    짧은 종목 제외
                  </button>
                  <button onClick={() => analysis.reset()}>취소</button>
                </div>
              ) : null}
              {analysis.data?.status === "completed" && analysis.data.values.length ? (
                <>
                  <HistoricalValueChart result={analysis.data} />
                  <p className="data-footnote">
                    실제 범위 {analysis.data.actualStart}~{analysis.data.endDate} · 제외{" "}
                    {analysis.data.excluded.map(({ symbol }) => symbol).join(", ") || "없음"}
                  </p>
                </>
              ) : null}
            </Panel>
            <Panel className="table-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">DETAIL</p>
                  <h2>구성 종목</h2>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>종목</th>
                      <th>수량</th>
                      <th>현재가</th>
                      <th>원화 평가금액</th>
                      <th>비중</th>
                    </tr>
                  </thead>
                  <tbody>
                    {composition.map(({ holding, quote, value, weight }) => (
                      <tr key={`${holding.exchange}:${holding.symbol}`}>
                        <th>
                          <strong>{holding.name}</strong>
                          <small>
                            {holding.symbol} · {holding.exchange}
                          </small>
                        </th>
                        <td>{holding.quantity}</td>
                        <td>
                          {quote?.price} {quote?.currency}
                        </td>
                        <td>{formatKrw(value!)}</td>
                        <td>{weight.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}

function formatKrw(value: Decimal) {
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value.toDecimalPlaces(0).toNumber())}원`;
}
