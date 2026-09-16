"use client";

import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { Copy, Sparkles } from "lucide-react";
import { useState } from "react";

import { AppHeader } from "@/components/app-header";
import { Panel } from "@/components/panel";
import { LocalUserDataRepository } from "@/composition/browser-user-data";
import { recommendationsDtoSchema, type RecommendationDto } from "@/contracts";
import type { StoredPortfolio, UserData } from "@/ports";

type Sort = "mdd" | "return" | "volatility" | "assets";
type Period = "6m" | "1y" | "3y" | "5y" | "7y" | "10y";

async function load(period: Period, signal: AbortSignal) {
  const response = await fetch(`/api/recommendations?period=${period}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return recommendationsDtoSchema.parse(await response.json());
}

export function RecommendationsDashboard() {
  const [period, setPeriod] = useState<Period>("10y");
  const [sort, setSort] = useState<Sort>("mdd");
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["recommendations", period],
    queryFn: ({ signal }) => load(period, signal),
  });
  const values = [...(query.data ?? [])].sort((a, b) => compare(a, b, sort));

  function toPortfolio(item: RecommendationDto): StoredPortfolio {
    return {
      id: crypto.randomUUID(),
      name: item.name,
      holdings: item.assets.map((asset) => ({
        symbol: asset.symbol,
        exchange: asset.exchange,
        name: asset.symbol,
        quantity: asset.quantity,
      })),
    };
  }

  function copyNew(item: RecommendationDto) {
    const repository = new LocalUserDataRepository(localStorage);
    const data = repository.load();
    if (
      !data.portfolios.length &&
      !data.watchlist.length &&
      !window.confirm(
        "추천 포트폴리오는 이 브라우저 기기에만 저장됩니다. 브라우저 데이터 삭제 시 복구할 수 없습니다. 저장할까요?",
      )
    )
      return;
    const portfolio = toPortfolio(item);
    repository.save({
      ...data,
      portfolios: [...data.portfolios, portfolio],
      activePortfolioId: portfolio.id,
    });
    setNotice(`${item.name}을(를) 새 포트폴리오로 저장했습니다.`);
  }

  function overwrite(item: RecommendationDto) {
    const repository = new LocalUserDataRepository(localStorage);
    const data = repository.load();
    const active =
      data.portfolios.find(({ id }) => id === data.activePortfolioId) ?? data.portfolios[0];
    if (!active) {
      copyNew(item);
      return;
    }
    const before = active.holdings
      .map(({ symbol, quantity }) => `${symbol} ${quantity}`)
      .join(", ");
    const after = item.assets.map(({ symbol, quantity }) => `${symbol} ${quantity}`).join(", ");
    if (
      !window.confirm(
        `기존: ${before || "비어 있음"}\n변경 후: ${after}\n현재 포트폴리오를 덮어쓸까요?`,
      )
    )
      return;
    const replacement = { ...toPortfolio(item), id: active.id };
    const next: UserData = {
      ...data,
      portfolios: data.portfolios.map((portfolio) =>
        portfolio.id === active.id ? replacement : portfolio,
      ),
    };
    repository.save(next);
    setNotice(`${item.name} 구성으로 현재 포트폴리오를 변경했습니다.`);
  }

  return (
    <>
      <AppHeader active="recommended" />
      <main className="market-shell recommendation-shell">
        <Panel className="recommendation-hero">
          <div>
            <p className="eyebrow">MODEL PORTFOLIOS</p>
            <h1>추천 포트폴리오 백테스트</h1>
            <p>초기금 1,000만 원의 과거 가상 시뮬레이션입니다. 개인화 투자 추천이 아닙니다.</p>
          </div>
          <div>
            <small>기준 초기금</small>
            <strong>10,000,000원</strong>
          </div>
        </Panel>
        <div className="recommendation-toolbar">
          <div className="segmented" aria-label="백테스트 기간">
            {(["6m", "1y", "3y", "5y", "7y", "10y"] as const).map((value) => (
              <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>
                {value === "6m" ? "6개월" : value.replace("y", "년")}
              </button>
            ))}
          </div>
          <label>
            정렬
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="mdd">MDD 낮은 순</option>
              <option value="return">누적 수익률 높은 순</option>
              <option value="volatility">변동성 낮은 순</option>
              <option value="assets">구성 종목 수</option>
            </select>
          </label>
        </div>
        {notice ? (
          <p className="save-notice" role="status">
            {notice}
          </p>
        ) : null}
        {query.isPending ? (
          <div className="chart-loading">추천안 백테스트를 계산하는 중…</div>
        ) : null}
        {query.isError ? (
          <div className="error-state" role="alert">
            추천 포트폴리오 데이터를 불러오지 못했습니다. 다시 시도해 주세요.
          </div>
        ) : null}
        <div className="recommendation-grid">
          {values.map((item, index) => (
            <RecommendationCard
              key={item.id}
              item={item}
              index={index}
              onCopy={() => copyNew(item)}
              onOverwrite={() => overwrite(item)}
            />
          ))}
        </div>
      </main>
    </>
  );
}

function RecommendationCard({
  item,
  index,
  onCopy,
  onOverwrite,
}: Readonly<{ item: RecommendationDto; index: number; onCopy(): void; onOverwrite(): void }>) {
  const colors = ["#3b82f6", "#16c493", "#8457ef", "#f59e0b", "#eb4894"];
  const stops = item.assets.map((asset, assetIndex) => {
    const start = item.assets
      .slice(0, assetIndex)
      .reduce((sum, value) => sum.plus(value.weight), new Decimal(0));
    const end = start.plus(asset.weight);
    return `${colors[assetIndex % colors.length]} ${start.toString()}% ${end.toString()}%`;
  });
  return (
    <Panel className="recommendation-card">
      <div className="recommendation-tag">
        <Sparkles size={13} />
        모델 {index + 1}
      </div>
      <h2>{item.name}</h2>
      <p>{item.description}</p>
      <div className="donut-row">
        <div
          className="donut"
          role="img"
          aria-label={`${item.name} 구성 비중 원형 차트`}
          style={{ background: `conic-gradient(${stops.join(",")})` }}
        >
          <span />
        </div>
        <ul>
          {item.assets.map((asset, assetIndex) => (
            <li key={asset.symbol}>
              <i style={{ background: colors[assetIndex % colors.length] }} />
              {asset.symbol} <strong>{asset.weight}%</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="recommendation-metrics">
        <span>
          <small>누적 수익률</small>
          <strong>{signed(item.metrics.cumulativeReturn)}%</strong>
        </span>
        <span>
          <small>MDD</small>
          <strong>-{new Decimal(item.metrics.maximumDrawdown).abs().toFixed(1)}%</strong>
        </span>
        <span>
          <small>CAGR</small>
          <strong>{item.metrics.cagr ? `${signed(item.metrics.cagr)}%` : "1년 미만"}</strong>
        </span>
        <span>
          <small>변동성</small>
          <strong>{new Decimal(item.metrics.annualizedVolatility).toFixed(1)}%</strong>
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>티커</th>
              <th>비중</th>
              <th>초기 배분 수량</th>
            </tr>
          </thead>
          <tbody>
            {item.assets.map((asset) => (
              <tr key={asset.symbol}>
                <th>{asset.symbol}</th>
                <td>{asset.weight}%</td>
                <td>{asset.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="assumption-copy">
        {item.startDate}~{item.endDate} · 조정 종가 · 배당 재투자 · 월별 리밸런싱 · 소수점 매수 ·
        수수료/세금 0원
      </p>
      <div className="copy-actions">
        <button onClick={onCopy}>
          <Copy size={15} />새 포트폴리오로 저장
        </button>
        <button onClick={onOverwrite}>현재 포트폴리오 덮어쓰기</button>
      </div>
    </Panel>
  );
}

function signed(value: string) {
  const decimal = new Decimal(value);
  return `${decimal.isPositive() ? "+" : ""}${decimal.toFixed(1)}`;
}
function compare(a: RecommendationDto, b: RecommendationDto, sort: Sort) {
  if (sort === "return")
    return new Decimal(b.metrics.cumulativeReturn).cmp(a.metrics.cumulativeReturn);
  if (sort === "volatility")
    return new Decimal(a.metrics.annualizedVolatility).cmp(b.metrics.annualizedVolatility);
  if (sort === "assets") return a.assets.length - b.assets.length;
  return new Decimal(a.metrics.maximumDrawdown).cmp(b.metrics.maximumDrawdown);
}
