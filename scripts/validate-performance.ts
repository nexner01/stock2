import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

const readOption = (name: string, fallback: string): string => {
  const index = process.argv.indexOf(name);
  const value = process.argv[index + 1];
  return index >= 0 && value ? value : fallback;
};

const round = (value: number): number => Math.round(value * 100) / 100;

const recommendationFixture = (id: string, name: string, cumulativeReturn: string) => ({
  id,
  name,
  description: "클라이언트 정렬 성능 측정 fixture",
  startDate: "2016-09-16",
  endDate: "2026-09-16",
  assets: [
    { symbol: "VTI", exchange: "XNYS", weight: "80", quantity: "12.5" },
    { symbol: "BND", exchange: "XNAS", weight: "20", quantity: "20" },
  ],
  metrics: {
    cumulativeReturn,
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

const measure = async (operation: () => Promise<void>): Promise<number> => {
  const startedAt = performance.now();
  await operation();
  return round(performance.now() - startedAt);
};

const baseUrl = readOption("--base-url", "http://127.0.0.1:3000");
const outputPath = resolve(readOption("--output", "docs/validation/app-performance.json"));
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const page = await browser.newPage();
  const firstScreenMs = await measure(async () => {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "주식 검색 및 시황" }).waitFor();
    await page.getByText(/초 자동 갱신/).waitFor();
  });
  const searchMs = await measure(async () => {
    const search = page.getByLabel("회사명 또는 티커 검색");
    await search.fill("AAPL");
    await search.press("Enter");
    await page
      .getByRole("button", { name: /검색 결과 .* AAPL 선택/ })
      .first()
      .waitFor();
  });
  await page
    .getByRole("button", { name: /검색 결과 .* AAPL 선택/ })
    .first()
    .click();
  await page.getByRole("button", { name: "1년" }).first().waitFor();
  const filterMs = await measure(async () => {
    const period = page.getByRole("button", { name: "1년" }).first();
    await Promise.all([
      page.waitForRequest((request) => request.url().includes("period=1y")),
      period.click(),
    ]);
  });

  await page.route("**/api/recommendations**", async (route) =>
    route.fulfill({
      json: [
        recommendationFixture("stock-80-bond-20", "Stock 80 / Bond 20", "84.2"),
        recommendationFixture("momentum-60-40", "Momentum 60 / 40", "92.1"),
      ],
    }),
  );
  await page.goto(`${baseUrl}/recommendations`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "추천 포트폴리오 백테스트" }).waitFor();
  await page.getByRole("heading", { name: "Stock 80 / Bond 20" }).waitFor();
  const sortMs = await measure(async () => {
    const sort = page.getByLabel("정렬");
    await sort.selectOption("return");
    const value = await sort.inputValue();
    if (value !== "return") throw new Error("정렬 선택이 반영되지 않았습니다.");
  });

  const result = {
    kind: "local-app-performance",
    executedAt: new Date().toISOString(),
    environment: { node: process.version, browser: "Google Chrome (headless)" },
    baseUrl,
    measurements: { firstScreenMs, searchMs, filterMs, sortMs },
    targetsMs: { firstScreen: 5_000, searchFilterSort: 1_000 },
    targetMet: {
      firstScreen: firstScreenMs <= 5_000,
      search: searchMs <= 1_000,
      filter: filterMs <= 1_000,
      sort: sortMs <= 1_000,
    },
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!Object.values(result.targetMet).every(Boolean)) process.exitCode = 1;
} finally {
  await browser.close();
}
