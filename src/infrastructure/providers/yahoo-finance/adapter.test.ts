// @vitest-environment node

import { Temporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInstrumentId } from "@/domain";

import chartFixture from "@/test/fixtures/yahoo/chart.json";
import fxChartFixture from "@/test/fixtures/yahoo/fx-chart.json";
import quoteFixture from "@/test/fixtures/yahoo/quote.json";
import searchFixture from "@/test/fixtures/yahoo/search.json";

import { YahooFinanceMarketDataProvider } from "./adapter";
import type { YahooApiClient } from "./client";
import { classifyProviderError, MarketDataProviderError } from "./errors";

const now = () => Temporal.Instant.from("2026-09-16T00:00:00Z");

const createClient = (overrides: Partial<YahooApiClient>): YahooApiClient => ({
  quote: overrides.quote ?? (() => Promise.reject(new Error("Unexpected quote call."))),
  chart: overrides.chart ?? (() => Promise.reject(new Error("Unexpected chart call."))),
  search: overrides.search ?? (() => Promise.reject(new Error("Unexpected search call."))),
});

const expectProviderCode = async (
  operation: Promise<unknown>,
  code: MarketDataProviderError["code"],
): Promise<void> => {
  await expect(operation).rejects.toMatchObject({ code });
};

describe("YahooFinanceMarketDataProvider", () => {
  afterEach(() => vi.useRealTimers());

  it("maps quote, index, search, details, OHLCV, and USD/KRW methods from fixed fixtures", async () => {
    const client = createClient({
      quote: () => Promise.resolve(quoteFixture),
      chart: (symbol) => Promise.resolve(symbol === "KRW=X" ? fxChartFixture : chartFixture),
      search: () => Promise.resolve(searchFixture),
    });
    const provider = new YahooFinanceMarketDataProvider(client, 5, now);
    const apple = createInstrumentId("AAPL", "XNAS");
    const periodStart = Temporal.Instant.from("2026-09-01T00:00:00Z");
    const periodEnd = Temporal.Instant.from("2026-09-16T00:00:00Z");

    const [quote] = await provider.getQuotes([apple]);
    const [indexLikeQuote] = await provider.getIndices([apple]);
    const [searchResult] = await provider.search("Apple");
    const details = await provider.getInstrumentDetails(apple);
    const ohlcv = await provider.getOhlcv({
      instrument: apple,
      interval: "1d",
      periodStart,
      periodEnd,
    });
    const exchangeRates = await provider.getExchangeRates({
      baseCurrency: "USD",
      quoteCurrency: "KRW",
      periodStart,
      periodEnd,
    });

    expect(quote?.price.value.toString()).toBe("231.45");
    expect(quote?.marketTimestamp.toString()).toBe("2026-09-15T20:00:00Z");
    expect(quote?.collectedAt.toString()).toBe("2026-09-16T00:00:00Z");
    expect(indexLikeQuote?.instrument).toEqual(apple);
    expect(searchResult?.instrument).toEqual(apple);
    expect(details.firstTradeAt?.toString()).toBe("1980-12-12T14:30:00Z");
    expect(ohlcv).toHaveLength(2);
    expect(ohlcv[1]?.adjustedClose.value.toString()).toBe("231.45");
    expect(exchangeRates[0]?.rate.value.toString()).toBe("1383.2");
  });

  it("passes a timeout AbortSignal to every provider request", async () => {
    vi.useFakeTimers();
    const client = createClient({
      quote: (_symbols, signal) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    });
    const provider = new YahooFinanceMarketDataProvider(client, 1, now);
    const operation = provider.getQuotes([createInstrumentId("AAPL", "XNAS")]);
    const expectation = expectProviderCode(operation, "timeout");

    await vi.advanceTimersByTimeAsync(1_000);
    await expectation;
  });

  it.each([
    [
      "missing field",
      (quote: (typeof chartFixture.quotes)[number]) => ({ ...quote, volume: undefined }),
    ],
    [
      "negative volume",
      (quote: (typeof chartFixture.quotes)[number]) => ({ ...quote, volume: -1 }),
    ],
    ["invalid OHLC", (quote: (typeof chartFixture.quotes)[number]) => ({ ...quote, high: 100 })],
  ])("rejects a malformed chart with %s", async (_label, change) => {
    const first = chartFixture.quotes.at(0);
    if (!first) throw new Error("Chart fixture must contain one quote.");
    const client = createClient({
      chart: () => Promise.resolve({ ...chartFixture, quotes: [change(first)] }),
    });
    const provider = new YahooFinanceMarketDataProvider(client, 5, now);

    await expectProviderCode(
      provider.getOhlcv({
        instrument: createInstrumentId("AAPL", "XNAS"),
        interval: "1d",
        periodStart: Temporal.Instant.from("2026-09-01T00:00:00Z"),
        periodEnd: Temporal.Instant.from("2026-09-16T00:00:00Z"),
      }),
      "malformed_response",
    );
  });

  it("rejects duplicate OHLCV timestamps", async () => {
    const first = chartFixture.quotes.at(0);
    if (!first) throw new Error("Chart fixture must contain one quote.");
    const client = createClient({
      chart: () => Promise.resolve({ ...chartFixture, quotes: [first, { ...first }] }),
    });
    const provider = new YahooFinanceMarketDataProvider(client, 5, now);

    await expectProviderCode(
      provider.getOhlcv({
        instrument: createInstrumentId("AAPL", "XNAS"),
        interval: "1d",
        periodStart: Temporal.Instant.from("2026-09-01T00:00:00Z"),
        periodEnd: Temporal.Instant.from("2026-09-16T00:00:00Z"),
      }),
      "malformed_response",
    );
  });

  it("classifies provider failures without exposing the original message", () => {
    const cases: readonly [unknown, MarketDataProviderError["code"]][] = [
      [{ statusCode: 429 }, "rate_limit"],
      [new Error("No data found for symbol"), "not_found"],
      [new Error("Invalid Search Query"), "unsupported"],
      [new Error("provider leaked internal payload"), "malformed_response"],
    ];

    for (const [error, code] of cases) {
      const classified = classifyProviderError(error);
      expect(classified.code).toBe(code);
      expect(classified.message).not.toContain("leaked");
    }
  });
});
