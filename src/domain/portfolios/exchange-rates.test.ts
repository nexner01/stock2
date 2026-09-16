import { Temporal } from "@js-temporal/polyfill";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { forwardFillExchangeRates } from "./exchange-rates";

const date = (value: string): Temporal.PlainDate => Temporal.PlainDate.from(value);

describe("AC-10 exchange-rate alignment", () => {
  it("uses only the latest historical rate and records its actual date", () => {
    const result = forwardFillExchangeRates(
      [date("2026-01-01"), date("2026-01-02"), date("2026-01-03")],
      [
        { date: date("2026-01-02"), rate: new Decimal("1450.25") },
        { date: date("2026-01-04"), rate: new Decimal("1460.50") },
      ],
    );

    expect(
      result.map(({ priceDate, rate, rateDate, forwardFilled }) => ({
        priceDate: priceDate.toString(),
        rate: rate.toString(),
        rateDate: rateDate.toString(),
        forwardFilled,
      })),
    ).toEqual([
      { priceDate: "2026-01-02", rate: "1450.25", rateDate: "2026-01-02", forwardFilled: false },
      { priceDate: "2026-01-03", rate: "1450.25", rateDate: "2026-01-02", forwardFilled: true },
    ]);
  });

  it("does not backfill dates before the first available exchange rate", () => {
    const result = forwardFillExchangeRates(
      [date("2026-01-01")],
      [{ date: date("2026-01-02"), rate: new Decimal("1450") }],
    );

    expect(result).toEqual([]);
  });
});
