import { createInstrumentId, type InstrumentId } from "@/domain";

import { MarketDataProviderError } from "./errors";

const knownSymbols = new Map<string, string>([
  ["KOSPI|XKRX", "^KS11"],
  ["KOSDAQ|XKOS", "^KQ11"],
  ["NASDAQ|XNAS", "^IXIC"],
  ["SP500|XNYS", "^GSPC"],
  ["USDKRW|FX", "KRW=X"],
]);

const knownInstruments = new Map<string, InstrumentId>(
  [...knownSymbols.entries()].map(([key, providerSymbol]) => {
    const [symbol, exchange] = key.split("|");
    if (!symbol || !exchange) throw new Error("Invalid built-in Yahoo symbol mapping.");
    return [providerSymbol, createInstrumentId(symbol, exchange)];
  }),
);

export const toYahooSymbol = (instrument: InstrumentId): string => {
  const known = knownSymbols.get(`${instrument.symbol}|${instrument.exchange}`);
  if (known) return known;
  if (instrument.exchange === "XKRX") return `${instrument.symbol}.KS`;
  if (instrument.exchange === "XKOS") return `${instrument.symbol}.KQ`;
  if (["XNAS", "XNYS", "ARCX"].includes(instrument.exchange)) return instrument.symbol;
  throw new MarketDataProviderError("unsupported");
};

const exchangeMap = new Map<string, string>([
  ["KSC", "XKRX"],
  ["KSE", "XKRX"],
  ["KOE", "XKOS"],
  ["KOSDAQ", "XKOS"],
  ["NMS", "XNAS"],
  ["NGM", "XNAS"],
  ["NCM", "XNAS"],
  ["NASDAQ", "XNAS"],
  ["NYQ", "XNYS"],
  ["NYE", "XNYS"],
  ["PCX", "ARCX"],
  ["ASE", "ARCX"],
]);

export const fromYahooSymbol = (
  providerSymbol: string,
  providerExchange: string,
): InstrumentId | null => {
  const known = knownInstruments.get(providerSymbol);
  if (known) return known;
  if (providerSymbol.endsWith(".KS")) {
    return createInstrumentId(providerSymbol.slice(0, -3), "XKRX");
  }
  if (providerSymbol.endsWith(".KQ")) {
    return createInstrumentId(providerSymbol.slice(0, -3), "XKOS");
  }
  const exchange = exchangeMap.get(providerExchange.toUpperCase());
  return exchange ? createInstrumentId(providerSymbol, exchange) : null;
};

export const yahooUsdKrwSymbol = "KRW=X";
