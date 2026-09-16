const SYMBOL_PATTERN = /^[A-Z0-9^.=\-]+$/;
const EXCHANGE_PATTERN = /^[A-Z0-9_-]+$/;

export type InstrumentId = Readonly<{
  symbol: string;
  exchange: string;
}>;

export const createInstrumentId = (symbol: string, exchange: string): InstrumentId => {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedExchange = exchange.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(normalizedSymbol)) {
    throw new Error(`Invalid instrument symbol: ${symbol}`);
  }
  if (!EXCHANGE_PATTERN.test(normalizedExchange)) {
    throw new Error(`Invalid exchange code: ${exchange}`);
  }
  return Object.freeze({ symbol: normalizedSymbol, exchange: normalizedExchange });
};

export const supportedCurrencies = ["KRW", "USD"] as const;
export type Currency = (typeof supportedCurrencies)[number];

export const createCurrency = (value: string): Currency => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "KRW" || normalized === "USD") return normalized;
  throw new Error(`Unsupported ISO 4217 currency for the MVP: ${value}`);
};

export const supportedIntervals = ["1m", "5m", "15m", "1h", "1d"] as const;
export type Interval = (typeof supportedIntervals)[number];

export const createInterval = (value: string): Interval => {
  switch (value) {
    case "1m":
    case "5m":
    case "15m":
    case "1h":
    case "1d":
      return value;
    default:
      throw new Error(`Unsupported market-data interval: ${value}`);
  }
};

export const marketStatuses = ["pre", "open", "post", "closed", "holiday", "unknown"] as const;
export type MarketStatus = (typeof marketStatuses)[number];

export const createMarketStatus = (value: string): MarketStatus => {
  switch (value) {
    case "pre":
    case "open":
    case "post":
    case "closed":
    case "holiday":
    case "unknown":
      return value;
    default:
      throw new Error(`Unsupported market status: ${value}`);
  }
};
