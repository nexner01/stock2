import { describe, expect, it } from "vitest";

import { createOhlcv } from "@/domain";

import { ohlcvDtoSchema, toOhlcvDto } from "./market-data";

describe("OHLCV public contract", () => {
  it("serializes the required identity fields and Decimal values as strings", () => {
    const dto = toOhlcvDto(
      createOhlcv({
        instrument: { symbol: "005930", exchange: "XKRX" },
        interval: "1d",
        timestamp: "2026-09-15T06:30:00Z",
        open: "70000.1",
        high: "71000.2",
        low: "69500.3",
        close: "70500.4",
        adjustedClose: "70400.5",
        volume: "123456",
        currency: "KRW",
        source: "yahoo-finance",
      }),
    );

    expect(dto).toMatchObject({
      symbol: "005930",
      exchange: "XKRX",
      adjusted_close: "70400.5",
      volume: "123456",
    });
    expect(ohlcvDtoSchema.safeParse({ ...dto, close: 70500.4 }).success).toBe(false);
  });
});
