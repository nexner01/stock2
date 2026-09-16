import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
};

const recommendationAssets = [
  { symbol: "VTI", exchange: "XNYS", weight: "80", quantity: "12.5" },
  { symbol: "BND", exchange: "XNAS", weight: "20", quantity: "20" },
];
const recommendation = (id: string, name: string) => ({
  id,
  name,
  description: "검증된 자산 배분 모델",
  startDate: "2016-09-16",
  endDate: "2026-09-16",
  assets: recommendationAssets,
  metrics: {
    cumulativeReturn: "84.2",
    cagr: "6.3",
    annualizedVolatility: "12.1",
    maximumDrawdown: "18.4",
    peakDate: "2020-02-19",
    troughDate: "2020-03-23",
  },
  assumptions: {
    initialKrw: "10000000",
    adjustedClose: true,
    dividendReinvestment: true,
    rebalancing: "monthly",
    fractionalShares: true,
    feesKrw: "0",
    taxesKrw: "0",
  },
});

test("200% 확대 등가 폭과 모바일에서 핵심 흐름이 잘림 없이 유지된다", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "stock2:user-data",
      JSON.stringify({
        version: 1,
        watchlist: [],
        activePortfolioId: "p",
        portfolios: [
          {
            id: "p",
            name: "내 포트폴리오",
            holdings: [{ symbol: "AAPL", exchange: "XNAS", name: "Apple", quantity: "1" }],
          },
        ],
      }),
    ),
  );
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "내 포트폴리오 분석" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.screenshot({ path: "docs/validation/m8-zoom-200.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recommendations");
  await expect(page.getByRole("heading", { name: "추천 포트폴리오 백테스트" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "docs/validation/m8-mobile.png", fullPage: true });
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/market/overview", async (route) =>
    route.fulfill({
      json: {
        pollIntervalSeconds: 2,
        limits: { watchlistMaxSymbols: 20, portfolioMaxSymbols: 10 },
        groups: [
          {
            id: "indices",
            status: "healthy",
            lastHealthyAt: quote.collectedAt,
            skipped: 0,
            values: [quote],
          },
          {
            id: "popular",
            status: "healthy",
            lastHealthyAt: quote.collectedAt,
            skipped: 0,
            values: [quote],
          },
          { id: "watchlist", status: "empty", lastHealthyAt: null, skipped: 0, values: [] },
          { id: "portfolio", status: "empty", lastHealthyAt: null, skipped: 0, values: [] },
        ],
      },
    }),
  );
  await page.route("**/api/market/instruments/**", async (route) =>
    route.fulfill({
      json: {
        quote,
        range: { start: "2026-09-14T00:00:00Z", end: "2026-09-16T00:00:00Z" },
        interval: "1d",
        ohlcv: [
          {
            timestamp: "2026-09-14T00:00:00Z",
            open: "225",
            high: "230",
            low: "224",
            close: "229",
            adjustedClose: "229",
            volume: "1000000",
          },
          {
            timestamp: "2026-09-16T00:00:00Z",
            open: "229",
            high: "233",
            low: "228",
            close: "231.25",
            adjustedClose: "231.25",
            volume: "1200000",
          },
        ],
      },
    }),
  );
  await page.route("**/api/market/search**", async (route) => route.fulfill({ json: [quote] }));
  await page.route("**/api/market/fx", async (route) =>
    route.fulfill({
      json: {
        base: "USD",
        quote: "KRW",
        rate: "1380.25",
        marketTimestamp: "2026-09-16T00:00:00Z",
        collectedAt: "2026-09-16T00:00:01Z",
      },
    }),
  );
  await page.route("**/api/portfolio-analysis", async (route) =>
    route.fulfill({
      json: {
        status: "completed",
        requestedStart: "2021-09-16",
        actualStart: "2021-09-16",
        endDate: "2026-09-16",
        affected: [],
        excluded: [],
        values: [
          { date: "2021-09-16", valueKrw: "500000" },
          { date: "2026-09-16", valueKrw: "797957" },
        ],
        appliedExchangeRateDates: { "2021-09-16": "2021-09-16", "2026-09-16": "2026-09-16" },
      },
    }),
  );
  await page.route("**/api/recommendations**", async (route) =>
    route.fulfill({
      json: [
        recommendation("stock-80-bond-20", "Stock 80 / Bond 20"),
        recommendation("momentum-60-40", "Momentum 60 / 40"),
        recommendation("all-weather", "All Weather"),
        recommendation("golden-butterfly", "Golden Butterfly"),
      ],
    }),
  );
});

test("시장 탐색 흐름과 중대 접근성 위반이 없다", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "주식 검색 및 시황" })).toBeVisible();
  await expect(page.getByText("2초 자동 갱신")).toBeVisible();
  const search = page.getByLabel("회사명 또는 티커 검색");
  await search.fill("AAPL");
  await search.press("Enter");
  await expect(page.getByRole("button", { name: "검색 결과 Apple Inc. AAPL 선택" })).toBeVisible();
  await page.getByRole("button", { name: "캔들" }).click();
  await expect(page.getByRole("button", { name: "캔들" })).toHaveAttribute("aria-pressed", "true");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "관심 종목 추가" }).click();
  await expect(page.getByRole("button", { name: "관심 종목 제거" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(search).toHaveValue("AAPL");
  await page.screenshot({
    path: "docs/validation/m5-market-overview.png",
    fullPage: true,
  });
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );
  expect(seriousViolations).toEqual([]);
});

test("포트폴리오는 저장 확인 후 새로고침에도 유지되고 삭제 취소는 무변경이다", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "내 포트폴리오 분석" })).toBeVisible();
  await page.getByLabel("티커").fill("AAPL");
  await page.getByLabel("보유 수량").fill("2.5");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText("AAPL · 2.5주")).toBeVisible();
  await page.getByRole("button", { name: "분석 실행" }).click();
  await expect(
    page.getByRole("img", { name: "현재 보유 수량 기준 과거 추정 가치 차트" }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/validation/m6-portfolio.png", fullPage: true });

  await page.reload();
  await expect(page.getByText("AAPL · 2.5주")).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "전체 초기화" }).click();
  await expect(page.getByText("AAPL · 2.5주")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);
});

test("추천안을 새 포트폴리오로 복사하고 덮어쓰기 취소는 기존 데이터를 보존한다", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "stock2:user-data",
      JSON.stringify({
        version: 1,
        watchlist: [],
        activePortfolioId: "existing",
        portfolios: [
          {
            id: "existing",
            name: "기존",
            holdings: [{ symbol: "AAPL", exchange: "XNAS", name: "Apple", quantity: "1" }],
          },
        ],
      }),
    ),
  );
  await page.goto("/recommendations");
  await expect(page.getByRole("heading", { name: "추천 포트폴리오 백테스트" })).toBeVisible();
  await page.getByRole("button", { name: "새 포트폴리오로 저장" }).first().click();
  await expect(page.getByRole("status")).toContainText("새 포트폴리오로 저장했습니다");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("stock2:user-data") ?? "{}").portfolios.length,
    ),
  ).toBe(2);
  const before = await page.evaluate(() => localStorage.getItem("stock2:user-data"));
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "현재 포트폴리오 덮어쓰기" }).first().click();
  expect(await page.evaluate(() => localStorage.getItem("stock2:user-data"))).toBe(before);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/validation/m7-recommendations.png", fullPage: true });
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);
});
