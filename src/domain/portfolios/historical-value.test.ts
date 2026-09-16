import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";

import { calculateHistoricalEstimatedValue } from "./historical-value";

const value = (date: string, amount: string) => ({
  date: Temporal.PlainDate.from(date),
  value: new Decimal(amount),
});

it("현재 수량과 과거 가격·과거 방향 환율로 추정 가치를 계산한다", () => {
  const result = calculateHistoricalEstimatedValue(
    [
      {
        symbol: "AAPL",
        quantity: new Decimal(2),
        currency: "USD",
        prices: [value("2026-01-02", "100"), value("2026-01-03", "110")],
      },
      {
        symbol: "005930",
        quantity: new Decimal(1),
        currency: "KRW",
        prices: [value("2026-01-02", "70000"), value("2026-01-03", "71000")],
      },
    ],
    [{ date: Temporal.PlainDate.from("2026-01-01"), rate: new Decimal(1400) }],
  );
  expect(result.values.map(({ value: total }) => total.toString())).toEqual(["350000", "379000"]);
  expect(result.appliedExchangeRateDates["2026-01-03"]).toBe("2026-01-01");
});

it("미래 환율을 역방향으로 채우지 않는다", () => {
  const result = calculateHistoricalEstimatedValue(
    [
      {
        symbol: "AAPL",
        quantity: new Decimal(1),
        currency: "USD",
        prices: [value("2026-01-01", "100"), value("2026-01-02", "101")],
      },
    ],
    [{ date: Temporal.PlainDate.from("2026-01-02"), rate: new Decimal(1400) }],
  );
  expect(result.values.map(({ date }) => date.toString())).toEqual(["2026-01-02"]);
});
