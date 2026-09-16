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

test.beforeEach(async ({ page }) => {
  await page.route("**/api/market/overview", async (route) =>
    route.fulfill({
      json: {
        pollIntervalSeconds: 2,
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
