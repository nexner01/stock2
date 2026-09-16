import type { Temporal } from "@js-temporal/polyfill";

import type {
  ExchangeRateObservation,
  InstrumentDetails,
  InstrumentId,
  InstrumentSearchResult,
  Interval,
  Ohlcv,
  QuoteSnapshot,
} from "@/domain";

export type OhlcvRequest = Readonly<{
  instrument: InstrumentId;
  interval: Interval;
  periodStart: Temporal.Instant;
  periodEnd: Temporal.Instant;
}>;

export type ExchangeRateRequest = Readonly<{
  baseCurrency: "USD";
  quoteCurrency: "KRW";
  periodStart: Temporal.Instant;
  periodEnd: Temporal.Instant;
}>;

export interface MarketDataProvider {
  getIndices(instruments: readonly InstrumentId[], signal?: AbortSignal): Promise<QuoteSnapshot[]>;
  getQuotes(instruments: readonly InstrumentId[], signal?: AbortSignal): Promise<QuoteSnapshot[]>;
  search(query: string, signal?: AbortSignal): Promise<InstrumentSearchResult[]>;
  getInstrumentDetails(instrument: InstrumentId, signal?: AbortSignal): Promise<InstrumentDetails>;
  getOhlcv(request: OhlcvRequest, signal?: AbortSignal): Promise<Ohlcv[]>;
  getExchangeRates(
    request: ExchangeRateRequest,
    signal?: AbortSignal,
  ): Promise<ExchangeRateObservation[]>;
}
