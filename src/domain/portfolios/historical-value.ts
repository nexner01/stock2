import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";

import type { DatedValue } from "./performance";

export type HistoricalHoldingSeries = Readonly<{
  symbol: string;
  quantity: Decimal;
  currency: "KRW" | "USD";
  prices: readonly DatedValue[];
}>;
export type HistoricalExchangeRate = Readonly<{ date: Temporal.PlainDate; rate: Decimal }>;
export type HistoricalValueResult = Readonly<{
  values: readonly DatedValue[];
  appliedExchangeRateDates: Readonly<Record<string, string>>;
}>;

export function calculateHistoricalEstimatedValue(
  holdings: readonly HistoricalHoldingSeries[],
  rates: readonly HistoricalExchangeRate[],
): HistoricalValueResult {
  if (!holdings.length) throw new Error("At least one holding is required.");
  const priceMaps = holdings.map(
    (holding) => new Map(holding.prices.map((point) => [point.date.toString(), point.value])),
  );
  const dates = [...(priceMaps[0]?.keys() ?? [])]
    .filter((date) => priceMaps.every((map) => map.has(date)))
    .sort();
  const sortedRates = [...rates].sort((a, b) => Temporal.PlainDate.compare(a.date, b.date));
  const applied: Record<string, string> = {};
  const values = dates.flatMap((dateText) => {
    const date = Temporal.PlainDate.from(dateText);
    let latestRate: HistoricalExchangeRate | undefined;
    for (const rate of sortedRates) {
      if (Temporal.PlainDate.compare(rate.date, date) <= 0) latestRate = rate;
      else break;
    }
    if (holdings.some(({ currency }) => currency === "USD") && !latestRate) return [];
    if (latestRate) applied[dateText] = latestRate.date.toString();
    const value = Decimal.sum(
      ...holdings.map((holding, index) =>
        holding.quantity
          .mul(priceMaps[index]?.get(dateText) ?? 0)
          .mul(holding.currency === "USD" ? (latestRate?.rate ?? 0) : 1),
      ),
    );
    return [{ date, value }];
  });
  return { values, appliedExchangeRateDates: applied };
}
