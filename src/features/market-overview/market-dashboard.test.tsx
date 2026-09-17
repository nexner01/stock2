import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { vi } from "vitest";

import { mockServer } from "@/test/server";

import { MarketDashboard } from "./market-dashboard";

vi.mock("@/components/charts/market-chart", () => ({
  MarketChart: () => <div role="img" aria-label="테스트 시장 차트" />,
}));

const quote = {
  symbol: "AAPL",
  exchange: "XNAS",
  name: "Apple Inc.",
  currency: "USD",
  price: "231.25",
  previousClose: "229.10",
  changePercent: "0.94",
  marketStatus: "open",
  marketTimestamp: "2026-09-16T01:00:00Z",
  collectedAt: "2026-09-16T01:00:01Z",
} as const;

const indexQuote = {
  ...quote,
  symbol: "KOSPI",
  exchange: "XKRX",
  name: "KOSPI",
  currency: "KRW",
} as const;

function overview() {
  return {
    pollIntervalSeconds: 2,
    limits: { watchlistMaxSymbols: 20, portfolioMaxSymbols: 10 },
    provider: { requestTimeoutSeconds: 5, batchSize: 10, maxSymbolsPerRequest: 10 },
    groups: [
      {
        id: "indices",
        status: "healthy",
        lastHealthyAt: quote.collectedAt,
        skipped: 0,
        consecutiveFailures: 0,
        stopped: false,
        batches: { total: 1, successful: 1, failed: 0 },
        values: [indexQuote],
      },
      {
        id: "popular",
        status: "healthy",
        lastHealthyAt: quote.collectedAt,
        skipped: 0,
        consecutiveFailures: 0,
        stopped: false,
        batches: { total: 1, successful: 1, failed: 0 },
        values: [quote],
      },
      {
        id: "watchlist",
        status: "empty",
        lastHealthyAt: null,
        skipped: 0,
        consecutiveFailures: 0,
        stopped: false,
        batches: { total: 0, successful: 0, failed: 0 },
        values: [],
      },
      {
        id: "portfolio",
        status: "empty",
        lastHealthyAt: null,
        skipped: 0,
        consecutiveFailures: 0,
        stopped: false,
        batches: { total: 0, successful: 0, failed: 0 },
        values: [],
      },
    ],
  };
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MarketDashboard />
    </QueryClientProvider>,
  );
}

describe("MarketDashboard", () => {
  beforeEach(() => localStorage.clear());

  it("적용 조회 주기와 시장 데이터를 표시한다", async () => {
    mockServer.use(
      http.get("/api/market/overview", () => HttpResponse.json(overview())),
      http.get("/api/market/instruments/:exchange/:symbol", () =>
        HttpResponse.json({ quote, range: null, interval: "1d", ohlcv: [] }),
      ),
    );
    renderDashboard();

    expect(await screen.findByText("2초 자동 갱신")).toBeInTheDocument();
    expect(screen.getAllByText("Apple Inc.").length).toBeGreaterThan(0);
  });

  it("배경 데이터가 도착해도 입력 중 검색어를 보존한다", async () => {
    mockServer.use(
      http.get("/api/market/overview", async () => {
        await delay(60);
        return HttpResponse.json(overview());
      }),
      http.get("/api/market/instruments/:exchange/:symbol", () =>
        HttpResponse.json({ quote, range: null, interval: "1d", ohlcv: [] }),
      ),
    );
    renderDashboard();
    const input = screen.getByLabelText("회사명 또는 티커 검색");
    await userEvent.type(input, "삼성전자");

    await waitFor(() => expect(screen.getByText("2초 자동 갱신")).toBeInTheDocument());
    expect(input).toHaveValue("삼성전자");
  });

  it("검색 결과를 선택하고 차트 유형을 키보드로 바꾼다", async () => {
    mockServer.use(
      http.get("/api/market/overview", () => HttpResponse.json(overview())),
      http.get("/api/market/search", () => HttpResponse.json([quote])),
      http.get("/api/market/instruments/:exchange/:symbol", () =>
        HttpResponse.json({ quote, range: null, interval: "1d", ohlcv: [] }),
      ),
    );
    renderDashboard();
    await userEvent.type(screen.getByLabelText("회사명 또는 티커 검색"), "AAPL{enter}");
    const result = await screen.findByRole("button", {
      name: "검색 결과 Apple Inc. AAPL 선택",
    });
    await userEvent.click(result);
    const candle = await screen.findByRole("button", { name: "캔들" });
    candle.focus();
    await userEvent.keyboard("{Enter}");
    expect(candle).toHaveAttribute("aria-pressed", "true");
  });

  it("주요 지수는 최대 5년, 개별 종목은 최대 10년 기간을 제공한다", async () => {
    mockServer.use(
      http.get("/api/market/overview", () => HttpResponse.json(overview())),
      http.get("/api/market/instruments/:exchange/:symbol", () =>
        HttpResponse.json({ quote, range: null, interval: "1d", ohlcv: [] }),
      ),
    );
    renderDashboard();

    const periodSelector = await screen.findByRole("group", { name: "조회 기간" });
    expect(periodSelector).toHaveTextContent("10년");
    await userEvent.click(screen.getByRole("button", { name: "주요 지수 KOSPI KOSPI 선택" }));
    await waitFor(() => {
      const updatedPeriodSelector = screen.getByRole("group", { name: "조회 기간" });
      expect(updatedPeriodSelector).toHaveTextContent("5년");
      expect(updatedPeriodSelector).not.toHaveTextContent("7년");
      expect(updatedPeriodSelector).not.toHaveTextContent("10년");
    });
  });

  it("관심 종목 한도 초과 시 기존 데이터 유지와 삭제 방법을 안내한다", async () => {
    const constrained = overview();
    constrained.limits.watchlistMaxSymbols = 1;
    localStorage.setItem(
      "stock2:user-data",
      JSON.stringify({
        version: 1,
        watchlist: [{ symbol: "MSFT", exchange: "XNAS", name: "Microsoft" }],
        portfolios: [],
        activePortfolioId: null,
      }),
    );
    mockServer.use(
      http.get("/api/market/overview", () => HttpResponse.json(constrained)),
      http.get("/api/market/instruments/:exchange/:symbol", () =>
        HttpResponse.json({ quote, range: null, interval: "1d", ohlcv: [] }),
      ),
    );
    renderDashboard();

    await userEvent.click(await screen.findByRole("button", { name: "관심 종목 추가" }));
    expect(screen.getByRole("alert")).toHaveTextContent("관심 종목은 최대 1개");
    expect(screen.getByRole("alert")).toHaveTextContent("기존 종목을 제거");
    expect(JSON.parse(localStorage.getItem("stock2:user-data") ?? "{}").watchlist).toHaveLength(1);
  });
});
