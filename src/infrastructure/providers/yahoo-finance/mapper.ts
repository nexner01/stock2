import { Temporal } from "@js-temporal/polyfill";

import {
  createAmount,
  createCurrency,
  createMarketStatus,
  createOhlcv,
  type ExchangeRateObservation,
  type InstrumentDetails,
  type InstrumentId,
  type InstrumentKind,
  type InstrumentSearchResult,
  type Interval,
  type Ohlcv,
  type QuoteSnapshot,
} from "@/domain";

import type { YahooChart, YahooQuote, YahooSearch } from "./schemas";
import { fromYahooSymbol, toYahooSymbol } from "./symbol-map";

const source = "yahoo-finance";

const toKind = (value: YahooQuote["quoteType"]): InstrumentKind => {
  switch (value) {
    case "EQUITY":
      return "equity";
    case "ETF":
      return "etf";
    case "INDEX":
      return "index";
    case "CURRENCY":
      return "currency";
  }
};

const toMarketStatus = (value: YahooQuote["marketState"]) => {
  switch (value) {
    case "REGULAR":
      return createMarketStatus("open");
    case "PRE":
    case "PREPRE":
      return createMarketStatus("pre");
    case "POST":
    case "POSTPOST":
      return createMarketStatus("post");
    case "CLOSED":
      return createMarketStatus("closed");
  }
};

const toInstant = (value: Date): Temporal.Instant =>
  Temporal.Instant.fromEpochMilliseconds(value.getTime());

export const mapYahooQuote = (
  raw: YahooQuote,
  instrument: InstrumentId,
  collectedAt: Temporal.Instant,
): QuoteSnapshot => {
  if (raw.symbol !== toYahooSymbol(instrument)) {
    throw new Error("Yahoo quote symbol does not match the requested instrument.");
  }
  return Object.freeze({
    instrument,
    name: raw.longName ?? raw.shortName ?? instrument.symbol,
    kind: toKind(raw.quoteType),
    currency: createCurrency(raw.currency),
    price: createAmount("price", raw.regularMarketPrice),
    previousClose: createAmount("price", raw.regularMarketPreviousClose),
    changePercent: createAmount("ratio", raw.regularMarketChangePercent),
    marketStatus: toMarketStatus(raw.marketState),
    marketTimestamp: toInstant(raw.regularMarketTime),
    collectedAt,
    source,
  });
};

export const mapYahooChart = (
  raw: YahooChart,
  instrument: InstrumentId,
  interval: Interval,
): Ohlcv[] => {
  if (raw.meta.symbol !== toYahooSymbol(instrument)) {
    throw new Error("Yahoo chart symbol does not match the requested instrument.");
  }
  const seen = new Set<string>();
  return raw.quotes.map((quote) => {
    const timestamp = toInstant(quote.date);
    const key = timestamp.toString();
    if (seen.has(key)) throw new Error("Yahoo chart contains a duplicate timestamp.");
    seen.add(key);
    return createOhlcv({
      instrument,
      interval,
      timestamp,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      adjustedClose: quote.adjclose,
      volume: quote.volume,
      currency: createCurrency(raw.meta.currency),
      source,
    });
  });
};

export const mapYahooExchangeRates = (
  raw: YahooChart,
  collectedAt: Temporal.Instant,
): ExchangeRateObservation[] => {
  const seen = new Set<string>();
  return raw.quotes.map((quote) => {
    const marketTimestamp = toInstant(quote.date);
    const key = marketTimestamp.toString();
    if (seen.has(key)) throw new Error("Yahoo exchange-rate chart contains a duplicate timestamp.");
    seen.add(key);
    return Object.freeze({
      baseCurrency: "USD",
      quoteCurrency: "KRW",
      rate: createAmount("exchangeRate", quote.close),
      marketTimestamp,
      collectedAt,
      source,
    });
  });
};

export const mapYahooInstrumentDetails = (
  raw: YahooQuote,
  instrument: InstrumentId,
  collectedAt: Temporal.Instant,
): InstrumentDetails =>
  Object.freeze({
    quote: mapYahooQuote(raw, instrument, collectedAt),
    exchangeTimezone: raw.exchangeTimezoneName,
    firstTradeAt: raw.firstTradeDateMilliseconds ? toInstant(raw.firstTradeDateMilliseconds) : null,
  });

export const supportedSearchInstruments = (raw: YahooSearch): ReadonlyMap<string, InstrumentId> => {
  const entries: [string, InstrumentId][] = [];
  for (const item of raw.quotes) {
    if (!item.isYahooFinance) continue;
    if (!["EQUITY", "ETF", "INDEX", "CURRENCY"].includes(item.quoteType)) continue;
    const instrument = fromYahooSymbol(item.symbol, item.exchange);
    if (instrument) entries.push([item.symbol, instrument]);
  }
  return new Map(entries);
};

export const toSearchResult = (quote: QuoteSnapshot): InstrumentSearchResult =>
  Object.freeze({
    instrument: quote.instrument,
    name: quote.name,
    kind: quote.kind,
    currency: quote.currency,
    currentPrice: quote.price,
    changePercent: quote.changePercent,
    marketTimestamp: quote.marketTimestamp,
    collectedAt: quote.collectedAt,
  });
