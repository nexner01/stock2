import { describe, expect, it } from "vitest";

import { createAmount, createMoney } from "./numbers";
import {
  createCurrency,
  createInstrumentId,
  createInterval,
  createMarketStatus,
} from "./instruments";

describe("instrument and numeric value objects", () => {
  it("normalizes instrument identifiers and supported ISO 4217 currencies", () => {
    expect(createInstrumentId(" aapl ", " nms ")).toEqual({ symbol: "AAPL", exchange: "NMS" });
    expect(createCurrency("usd")).toBe("USD");
    expect(createInterval("15m")).toBe("15m");
    expect(createMarketStatus("holiday")).toBe("holiday");
  });

  it("rejects unsupported currency and malformed identifiers", () => {
    expect(() => createCurrency("EUR")).toThrow("Unsupported ISO 4217 currency");
    expect(() => createInstrumentId("AAPL!", "NMS")).toThrow("Invalid instrument symbol");
    expect(() => createInterval("2h")).toThrow("Unsupported market-data interval");
    expect(() => createMarketStatus("trading")).toThrow("Unsupported market status");
  });

  it("models money, price, exchange rate, quantity, and ratio with Decimal", () => {
    expect(createMoney("0.1", "KRW").value.plus("0.2").toString()).toBe("0.3");
    for (const kind of ["price", "exchangeRate", "quantity", "ratio"] as const) {
      expect(createAmount(kind, "1.25").value.toString()).toBe("1.25");
    }
  });
});
