import type { Temporal } from "@js-temporal/polyfill";

import type { Currency, InstrumentId, MarketStatus } from "../instruments";
import type { DecimalAmount } from "../numbers";

export type InstrumentKind = "equity" | "etf" | "index" | "currency";

export type QuoteSnapshot = Readonly<{
  instrument: InstrumentId;
  name: string;
  kind: InstrumentKind;
  currency: Currency;
  price: DecimalAmount<"price">;
  previousClose: DecimalAmount<"price">;
  changePercent: DecimalAmount<"ratio">;
  marketStatus: MarketStatus;
  marketTimestamp: Temporal.Instant;
  collectedAt: Temporal.Instant;
  source: string;
}>;

export type InstrumentSearchResult = Readonly<{
  instrument: InstrumentId;
  name: string;
  kind: InstrumentKind;
  currency: Currency;
  currentPrice: DecimalAmount<"price">;
  changePercent: DecimalAmount<"ratio">;
  marketTimestamp: Temporal.Instant;
  collectedAt: Temporal.Instant;
}>;

export type InstrumentDetails = Readonly<{
  quote: QuoteSnapshot;
  exchangeTimezone: string;
  firstTradeAt: Temporal.Instant | null;
}>;

export type ExchangeRateObservation = Readonly<{
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate: DecimalAmount<"exchangeRate">;
  marketTimestamp: Temporal.Instant;
  collectedAt: Temporal.Instant;
  source: string;
}>;
