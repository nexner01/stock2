import "server-only";

import YahooFinance from "yahoo-finance2";

import type { Interval } from "@/domain";

export type YahooChartRequest = Readonly<{
  periodStart: Date;
  periodEnd: Date;
  interval: Interval;
}>;

export interface YahooApiClient {
  quote(symbols: readonly string[], signal: AbortSignal): Promise<unknown>;
  chart(symbol: string, request: YahooChartRequest, signal: AbortSignal): Promise<unknown>;
  search(query: string, signal: AbortSignal): Promise<unknown>;
}

export class YahooFinanceApiClient implements YahooApiClient {
  private readonly client = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

  async quote(symbols: readonly string[], signal: AbortSignal): Promise<unknown> {
    return this.client.quote([...symbols], undefined, { fetchOptions: { signal } });
  }

  async chart(symbol: string, request: YahooChartRequest, signal: AbortSignal): Promise<unknown> {
    return this.client.chart(
      symbol,
      {
        period1: request.periodStart,
        period2: request.periodEnd,
        interval: request.interval,
        events: "div|split",
      },
      { fetchOptions: { signal } },
    );
  }

  async search(query: string, signal: AbortSignal): Promise<unknown> {
    return this.client.search(
      query,
      { newsCount: 0, quotesCount: 10 },
      { fetchOptions: { signal } },
    );
  }
}
