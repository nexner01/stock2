import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";

import { compareDates } from "../time";

export type DatedValue = Readonly<{
  date: Temporal.PlainDate;
  value: Decimal;
}>;

export type DatedReturn = Readonly<{
  date: Temporal.PlainDate;
  value: Decimal;
}>;

export type MaximumDrawdown = Readonly<{
  value: Decimal;
  peakDate: Temporal.PlainDate;
  troughDate: Temporal.PlainDate;
}>;

export type PerformanceMetrics = Readonly<{
  cumulativeReturn: Decimal;
  cagr: Decimal | null;
  annualizedVolatility: Decimal;
  maximumDrawdown: MaximumDrawdown;
  primaryReturnMetric: "cumulativeReturn" | "cagr";
  analysisDays: number;
  assumptions: Readonly<{
    tradingDaysPerYear: 252;
    volatilityStandardDeviation: "population";
  }>;
}>;

const validateSeries = (series: readonly DatedValue[], minimumLength: number): void => {
  if (series.length < minimumLength) {
    throw new Error(`At least ${minimumLength} dated values are required.`);
  }
  for (let index = 0; index < series.length; index += 1) {
    const current = series[index];
    if (!current) throw new Error("Dated value is missing.");
    if (!current.value.isFinite() || current.value.isNegative()) {
      throw new Error("Portfolio values must be finite and non-negative.");
    }
    const previous = series[index - 1];
    if (previous && compareDates(previous.date, current.date) >= 0) {
      throw new Error("Dated values must be strictly ordered without duplicate dates.");
    }
  }
};

const requirePositiveEndpoints = (series: readonly DatedValue[]): void => {
  const first = series[0];
  const last = series.at(-1);
  if (!first || !last || first.value.isZero() || last.value.isZero()) {
    throw new Error("Start and end values must be greater than zero.");
  }
};

export const calculateDailyReturns = (series: readonly DatedValue[]): readonly DatedReturn[] => {
  validateSeries(series, 2);
  return series.slice(1).map((current, index) => {
    const previous = series[index];
    if (!previous || previous.value.isZero()) {
      throw new Error("Previous value must be greater than zero for a daily return.");
    }
    return Object.freeze({ date: current.date, value: current.value.div(previous.value).minus(1) });
  });
};

export const calculateCumulativeReturn = (series: readonly DatedValue[]): Decimal => {
  validateSeries(series, 2);
  requirePositiveEndpoints(series);
  const first = series[0];
  const last = series.at(-1);
  if (!first || !last) throw new Error("Performance endpoints are required.");
  return last.value.div(first.value).minus(1);
};

const analysisDays = (series: readonly DatedValue[]): number => {
  const first = series[0];
  const last = series.at(-1);
  if (!first || !last) throw new Error("Performance endpoints are required.");
  return first.date.until(last.date, { largestUnit: "day" }).days;
};

export const calculateCagr = (series: readonly DatedValue[]): Decimal => {
  validateSeries(series, 2);
  requirePositiveEndpoints(series);
  const days = analysisDays(series);
  if (days <= 0) throw new Error("CAGR requires a positive analysis duration.");
  const first = series[0];
  const last = series.at(-1);
  if (!first || !last) throw new Error("Performance endpoints are required.");
  return last.value.div(first.value).pow(new Decimal(365).div(days)).minus(1);
};

export const calculateAnnualizedVolatility = (dailyReturns: readonly DatedReturn[]): Decimal => {
  if (dailyReturns.length === 0) return new Decimal(0);
  const mean = Decimal.sum(...dailyReturns.map(({ value }) => value)).div(dailyReturns.length);
  const variance = Decimal.sum(...dailyReturns.map(({ value }) => value.minus(mean).pow(2))).div(
    dailyReturns.length,
  );
  return variance.sqrt().mul(new Decimal(252).sqrt());
};

export const calculateMaximumDrawdown = (series: readonly DatedValue[]): MaximumDrawdown => {
  validateSeries(series, 1);
  const first = series[0];
  if (!first || first.value.isZero()) throw new Error("MDD requires a positive first value.");
  let peak = first;
  let maximum = new Decimal(0);
  let peakDate = first.date;
  let troughDate = first.date;

  for (const current of series) {
    if (current.value.greaterThan(peak.value)) peak = current;
    if (peak.value.isZero()) continue;
    const drawdown = new Decimal(1).minus(current.value.div(peak.value));
    if (drawdown.greaterThan(maximum)) {
      maximum = drawdown;
      peakDate = peak.date;
      troughDate = current.date;
    }
  }

  return Object.freeze({ value: maximum, peakDate, troughDate });
};

export const calculatePerformanceMetrics = (series: readonly DatedValue[]): PerformanceMetrics => {
  const days = analysisDays(series);
  const cumulativeReturn = calculateCumulativeReturn(series);
  return Object.freeze({
    cumulativeReturn,
    cagr: days < 365 ? null : calculateCagr(series),
    annualizedVolatility: calculateAnnualizedVolatility(calculateDailyReturns(series)),
    maximumDrawdown: calculateMaximumDrawdown(series),
    primaryReturnMetric: days < 365 ? "cumulativeReturn" : "cagr",
    analysisDays: days,
    assumptions: Object.freeze({
      tradingDaysPerYear: 252 as const,
      volatilityStandardDeviation: "population" as const,
    }),
  });
};
