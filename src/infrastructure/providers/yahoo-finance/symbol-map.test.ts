// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createInstrumentId } from "@/domain";

import { MarketDataProviderError } from "./errors";
import { fromYahooSymbol, toYahooSymbol } from "./symbol-map";

describe("Yahoo symbol mapping", () => {
  it.each([
    [createInstrumentId("KOSPI", "XKRX"), "^KS11"],
    [createInstrumentId("KOSDAQ", "XKOS"), "^KQ11"],
    [createInstrumentId("NASDAQ", "XNAS"), "^IXIC"],
    [createInstrumentId("SP500", "XNYS"), "^GSPC"],
    [createInstrumentId("005930", "XKRX"), "005930.KS"],
    [createInstrumentId("035720", "XKOS"), "035720.KQ"],
    [createInstrumentId("AAPL", "XNAS"), "AAPL"],
    [createInstrumentId("DBC", "ARCX"), "DBC"],
  ])("maps %o to %s", (instrument, expected) => {
    expect(toYahooSymbol(instrument)).toBe(expected);
  });

  it("maps provider symbols back to stable instrument identities", () => {
    expect(fromYahooSymbol("005930.KS", "KSC")).toEqual(createInstrumentId("005930", "XKRX"));
    expect(fromYahooSymbol("AAPL", "NMS")).toEqual(createInstrumentId("AAPL", "XNAS"));
    expect(fromYahooSymbol("UNKNOWN", "CRYPTO")).toBeNull();
  });

  it("classifies an unsupported exchange explicitly", () => {
    expect(() => toYahooSymbol(createInstrumentId("7203", "XTKS"))).toThrow(
      MarketDataProviderError,
    );
  });
});
