import { Temporal } from "@js-temporal/polyfill";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  calculateAnnualizedVolatility,
  calculateCagr,
  calculateCumulativeReturn,
  calculateDailyReturns,
  calculateMaximumDrawdown,
  calculatePerformanceMetrics,
  type DatedValue,
} from "./performance";

const point = (date: string, value: string): DatedValue => ({
  date: Temporal.PlainDate.from(date),
  value: new Decimal(value),
});

describe("PDD §7 performance formulas", () => {
  it("calculates daily and cumulative returns with Decimal", () => {
    const series = [
      point("2026-01-01", "100"),
      point("2026-01-02", "110"),
      point("2026-01-03", "99"),
    ];

    expect(calculateDailyReturns(series).map(({ value }) => value.toString())).toEqual([
      "0.1",
      "-0.1",
    ]);
    expect(calculateCumulativeReturn(series).toString()).toBe("-0.01");
  });

  it("calculates CAGR using 365 divided by actual analysis days", () => {
    const series = [point("2024-01-01", "100"), point("2025-12-31", "121")];

    expect(calculateCagr(series).toDecimalPlaces(12).toString()).toBe("0.1");
  });

  it("annualizes the population standard deviation with sqrt(252)", () => {
    const returns = calculateDailyReturns([
      point("2026-01-01", "100"),
      point("2026-01-02", "110"),
      point("2026-01-03", "99"),
    ]);

    expect(calculateAnnualizedVolatility(returns).toDecimalPlaces(12).toString()).toBe(
      new Decimal("0.1").mul(new Decimal(252).sqrt()).toDecimalPlaces(12).toString(),
    );
  });

  it("returns MDD with the corresponding peak and trough dates", () => {
    const result = calculateMaximumDrawdown([
      point("2026-01-01", "100"),
      point("2026-01-02", "120"),
      point("2026-01-03", "90"),
      point("2026-01-04", "108"),
    ]);

    expect(result.value.toString()).toBe("0.25");
    expect(result.peakDate.toString()).toBe("2026-01-02");
    expect(result.troughDate.toString()).toBe("2026-01-03");
  });

  it("prioritizes cumulative return and omits CAGR for periods shorter than one year", () => {
    const result = calculatePerformanceMetrics([
      point("2026-01-01", "100"),
      point("2026-06-30", "110"),
    ]);

    expect(result.primaryReturnMetric).toBe("cumulativeReturn");
    expect(result.cagr).toBeNull();
    expect(result.cumulativeReturn.toString()).toBe("0.1");
  });

  it("is deterministic for identical inputs and assumptions", () => {
    const series = [point("2025-01-01", "100"), point("2026-01-01", "110")];

    const first = calculatePerformanceMetrics(series);
    const second = calculatePerformanceMetrics(series);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
