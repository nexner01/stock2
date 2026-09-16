import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";

import {
  calculatePerformanceMetrics,
  type DatedValue,
  type PerformanceMetrics,
} from "../portfolios/performance";

export type RecommendationAsset = Readonly<{
  symbol: string;
  exchange: "XNAS" | "XNYS";
  weight: Decimal;
}>;
export type Recommendation = Readonly<{
  id: string;
  name: string;
  description: string;
  assets: readonly RecommendationAsset[];
}>;
export type AssetPriceSeries = Readonly<{ symbol: string; values: readonly DatedValue[] }>;

const asset = (
  symbol: string,
  weight: string,
  exchange: "XNAS" | "XNYS" = "XNYS",
): RecommendationAsset => ({ symbol, exchange, weight: new Decimal(weight) });

export const recommendations: readonly Recommendation[] = Object.freeze([
  {
    id: "stock-80-bond-20",
    name: "Stock 80 / Bond 20",
    description: "미국 전체 주식과 종합 채권의 80:20 배분",
    assets: [asset("VTI", "80"), asset("BND", "20", "XNAS")],
  },
  {
    id: "momentum-60-40",
    name: "Momentum 60 / 40",
    description: "미국 모멘텀 주식과 종합 채권의 60:40 배분",
    assets: [asset("MTUM", "60"), asset("BND", "40", "XNAS")],
  },
  {
    id: "all-weather",
    name: "All Weather",
    description: "주식·장기채·중기채·원자재·금에 분산한 올웨더 배분",
    assets: [
      asset("VTI", "30"),
      asset("TLT", "40", "XNAS"),
      asset("IEF", "15", "XNAS"),
      asset("DBC", "7.5"),
      asset("GLD", "7.5"),
    ],
  },
  {
    id: "golden-butterfly",
    name: "Golden Butterfly",
    description: "소형가치·시장·단기채·장기채·금을 동일 비중으로 배분",
    assets: [
      asset("IJS", "20"),
      asset("VTI", "20"),
      asset("SHY", "20", "XNAS"),
      asset("TLT", "20", "XNAS"),
      asset("GLD", "20"),
    ],
  },
]);

export type BacktestResult = Readonly<{
  values: readonly DatedValue[];
  metrics: PerformanceMetrics;
  startDate: Temporal.PlainDate;
  endDate: Temporal.PlainDate;
  assumptions: Readonly<{
    initialKrw: "10000000";
    adjustedClose: true;
    dividendReinvestment: true;
    rebalancing: "monthly";
    fractionalShares: true;
    feesKrw: "0";
    taxesKrw: "0";
  }>;
}>;

export function backtestRecommendation(
  recommendation: Recommendation,
  series: readonly AssetPriceSeries[],
): BacktestResult {
  const totalWeight = Decimal.sum(...recommendation.assets.map(({ weight }) => weight));
  if (!totalWeight.eq(100)) throw new Error("Recommendation weights must sum to 100%.");
  const bySymbol = new Map(
    series.map((item) => [
      item.symbol,
      new Map(item.values.map((value) => [value.date.toString(), value.value])),
    ]),
  );
  for (const item of recommendation.assets)
    if (!bySymbol.has(item.symbol)) throw new Error(`Missing price series for ${item.symbol}.`);
  const commonDates = [...(bySymbol.get(recommendation.assets[0]?.symbol ?? "")?.keys() ?? [])]
    .filter((date) => recommendation.assets.every(({ symbol }) => bySymbol.get(symbol)?.has(date)))
    .sort();
  if (commonDates.length < 2) throw new Error("Backtest requires at least two common dates.");
  let shares = new Map<string, Decimal>();
  let lastMonth = "";
  const values: DatedValue[] = [];
  for (const dateText of commonDates) {
    const date = Temporal.PlainDate.from(dateText);
    const currentValue = shares.size
      ? Decimal.sum(
          ...recommendation.assets.map(({ symbol }) =>
            (shares.get(symbol) ?? new Decimal(0)).mul(bySymbol.get(symbol)?.get(dateText) ?? 0),
          ),
        )
      : new Decimal("10000000");
    const month = dateText.slice(0, 7);
    if (month !== lastMonth) {
      shares = new Map(
        recommendation.assets.map(({ symbol, weight }) => [
          symbol,
          currentValue
            .mul(weight)
            .div(100)
            .div(bySymbol.get(symbol)?.get(dateText) ?? 1),
        ]),
      );
      lastMonth = month;
    }
    values.push({
      date,
      value: Decimal.sum(
        ...recommendation.assets.map(({ symbol }) =>
          (shares.get(symbol) ?? new Decimal(0)).mul(bySymbol.get(symbol)?.get(dateText) ?? 0),
        ),
      ),
    });
  }
  const first = values[0];
  const last = values.at(-1);
  if (!first || !last) throw new Error("Backtest range is empty.");
  return {
    values,
    metrics: calculatePerformanceMetrics(values),
    startDate: first.date,
    endDate: last.date,
    assumptions: {
      initialKrw: "10000000",
      adjustedClose: true,
      dividendReinvestment: true,
      rebalancing: "monthly",
      fractionalShares: true,
      feesKrw: "0",
      taxesKrw: "0",
    },
  };
}
