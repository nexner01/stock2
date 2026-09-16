import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";

import { backtestRecommendation, recommendations } from "./recommended-portfolios";

const point = (date: string, value: string) => ({
  date: Temporal.PlainDate.from(date),
  value: new Decimal(value),
});

describe("recommended portfolio backtest", () => {
  it("네 초기 추천안의 비중 합과 DBC 심볼을 보장한다", () => {
    expect(recommendations).toHaveLength(4);
    for (const recommendation of recommendations)
      expect(Decimal.sum(...recommendation.assets.map(({ weight }) => weight)).toString()).toBe(
        "100",
      );
    expect(
      recommendations.find(({ id }) => id === "all-weather")?.assets.map(({ symbol }) => symbol),
    ).toContain("DBC");
  });

  it("공통 시작일과 월별 리밸런싱으로 결정론적 결과와 가정을 반환한다", () => {
    const recommendation = recommendations[0];
    if (!recommendation) throw new Error("missing fixture");
    const result = backtestRecommendation(recommendation, [
      {
        symbol: "VTI",
        values: [
          point("2025-01-02", "100"),
          point("2025-01-31", "110"),
          point("2025-02-03", "105"),
          point("2026-02-03", "120"),
        ],
      },
      {
        symbol: "BND",
        values: [
          point("2025-01-02", "50"),
          point("2025-01-31", "50"),
          point("2025-02-03", "51"),
          point("2026-02-03", "52"),
        ],
      },
    ]);
    expect(result.startDate.toString()).toBe("2025-01-02");
    expect(result.metrics.cagr).not.toBeNull();
    expect(result.assumptions).toMatchObject({
      initialKrw: "10000000",
      rebalancing: "monthly",
      fractionalShares: true,
      feesKrw: "0",
    });
  });
});
