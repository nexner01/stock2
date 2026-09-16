import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";

import { compareDates } from "../time";

export type DatedExchangeRate = Readonly<{
  date: Temporal.PlainDate;
  rate: Decimal;
}>;

export type AlignedExchangeRate = Readonly<{
  priceDate: Temporal.PlainDate;
  rate: Decimal;
  rateDate: Temporal.PlainDate;
  forwardFilled: boolean;
}>;

const assertStrictlyOrdered = (dates: readonly Temporal.PlainDate[], label: string): void => {
  for (let index = 1; index < dates.length; index += 1) {
    const previous = dates[index - 1];
    const current = dates[index];
    if (!previous || !current || compareDates(previous, current) >= 0) {
      throw new Error(`${label} must be strictly ordered without duplicate dates.`);
    }
  }
};

export const forwardFillExchangeRates = (
  priceDates: readonly Temporal.PlainDate[],
  exchangeRates: readonly DatedExchangeRate[],
): readonly AlignedExchangeRate[] => {
  assertStrictlyOrdered(priceDates, "Price dates");
  assertStrictlyOrdered(
    exchangeRates.map(({ date }) => date),
    "Exchange rates",
  );
  for (const { rate } of exchangeRates) {
    if (!rate.isFinite() || !rate.isPositive()) {
      throw new Error("Exchange rates must be finite and greater than zero.");
    }
  }

  const aligned: AlignedExchangeRate[] = [];
  let rateIndex = 0;
  let latest: DatedExchangeRate | undefined;
  for (const priceDate of priceDates) {
    while (rateIndex < exchangeRates.length) {
      const candidate = exchangeRates[rateIndex];
      if (!candidate || compareDates(candidate.date, priceDate) > 0) break;
      latest = candidate;
      rateIndex += 1;
    }
    if (!latest) continue;
    aligned.push(
      Object.freeze({
        priceDate,
        rate: latest.rate,
        rateDate: latest.date,
        forwardFilled: compareDates(latest.date, priceDate) !== 0,
      }),
    );
  }
  return aligned;
};
