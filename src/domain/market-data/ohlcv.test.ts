import { describe, expect, it } from "vitest";

import { toOhlcvDto } from "@/contracts";

import { createCurrency, createInstrumentId } from "../instruments";
import { createOhlcv, ohlcvIdentityKey } from "./ohlcv";

const validInput = {
  instrument: createInstrumentId("005930.ks", "kse"),
  interval: "1d" as const,
  timestamp: "2026-09-16T00:00:00Z",
  open: "70000.10",
  high: "71000.20",
  low: "69000.30",
  close: "70500.40",
  adjustedClose: "70450.50",
  volume: "1234567",
  currency: createCurrency("krw"),
  source: "yahoo-finance",
};

describe("OHLCV domain model", () => {
  it("uses symbol, exchange, interval, timestamp, and source as its identity", () => {
    const value = createOhlcv(validInput);

    expect(ohlcvIdentityKey(value)).toBe("005930.KS|KSE|1d|2026-09-16T00:00:00Z|yahoo-finance");
  });

  it.each([
    ["negative volume", { volume: "-1" }],
    ["fractional volume", { volume: "1.5" }],
    ["high below close", { high: "70000", close: "70500" }],
    ["low above open", { low: "70001", open: "70000" }],
  ])("rejects invalid %s", (_label, overrides) => {
    expect(() => createOhlcv({ ...validInput, ...overrides })).toThrow();
  });

  it("serializes Decimal values as strings and time as UTC ISO 8601", () => {
    const dto = toOhlcvDto(createOhlcv(validInput));

    expect(dto).toMatchObject({
      timestamp: "2026-09-16T00:00:00Z",
      open: "70000.1",
      adjusted_close: "70450.5",
      volume: "1234567",
      currency: "KRW",
    });
    expect(typeof dto.open).toBe("string");
  });
});
