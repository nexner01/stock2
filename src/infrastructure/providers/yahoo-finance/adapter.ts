import "server-only";

import { Temporal } from "@js-temporal/polyfill";

import type {
  ExchangeRateObservation,
  InstrumentDetails,
  InstrumentId,
  InstrumentSearchResult,
  Ohlcv,
  QuoteSnapshot,
} from "@/domain";
import type { ExchangeRateRequest, MarketDataProvider, OhlcvRequest } from "@/ports";

import type { YahooApiClient } from "./client";
import { classifyProviderError, MarketDataProviderError } from "./errors";
import {
  mapYahooChart,
  mapYahooExchangeRates,
  mapYahooInstrumentDetails,
  mapYahooQuote,
  supportedSearchInstruments,
  toSearchResult,
} from "./mapper";
import { yahooChartSchema, yahooQuoteBatchSchema, yahooSearchSchema } from "./schemas";
import { toYahooSymbol, yahooUsdKrwSymbol } from "./symbol-map";

type Now = () => Temporal.Instant;

export class YahooFinanceMarketDataProvider implements MarketDataProvider {
  constructor(
    private readonly client: YahooApiClient,
    private readonly timeoutSeconds: number,
    private readonly now: Now = () => Temporal.Now.instant(),
  ) {
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1) {
      throw new Error("Yahoo provider timeout must be a positive integer.");
    }
  }

  async getIndices(
    instruments: readonly InstrumentId[],
    signal?: AbortSignal,
  ): Promise<QuoteSnapshot[]> {
    return this.getQuotes(instruments, signal);
  }

  async getQuotes(
    instruments: readonly InstrumentId[],
    signal?: AbortSignal,
  ): Promise<QuoteSnapshot[]> {
    if (instruments.length === 0) return [];
    return this.execute(signal, async (requestSignal) => {
      const requested = new Map(
        instruments.map((instrument) => [toYahooSymbol(instrument), instrument]),
      );
      const parsed = yahooQuoteBatchSchema.parse(
        await this.client.quote([...requested.keys()], requestSignal),
      );
      const collectedAt = this.now();
      const seen = new Set<string>();
      const values = parsed.map((raw) => {
        if (seen.has(raw.symbol)) throw new Error("Yahoo quote batch contains a duplicate symbol.");
        seen.add(raw.symbol);
        const instrument = requested.get(raw.symbol);
        if (!instrument) throw new Error("Yahoo quote batch contains an unrequested symbol.");
        return mapYahooQuote(raw, instrument, collectedAt);
      });
      if (values.length !== requested.size) throw new MarketDataProviderError("not_found");
      return values;
    });
  }

  async search(query: string, signal?: AbortSignal): Promise<InstrumentSearchResult[]> {
    const normalized = query.trim();
    if (!normalized) return [];
    return this.execute(signal, async (requestSignal) => {
      const search = yahooSearchSchema.parse(await this.client.search(normalized, requestSignal));
      const instrumentsByProviderSymbol = supportedSearchInstruments(search);
      if (instrumentsByProviderSymbol.size === 0) return [];
      const quotes = yahooQuoteBatchSchema.parse(
        await this.client.quote([...instrumentsByProviderSymbol.keys()], requestSignal),
      );
      const collectedAt = this.now();
      return quotes.map((raw) => {
        const instrument = instrumentsByProviderSymbol.get(raw.symbol);
        if (!instrument) throw new Error("Yahoo search quote contains an unrequested symbol.");
        return toSearchResult(mapYahooQuote(raw, instrument, collectedAt));
      });
    });
  }

  async getInstrumentDetails(
    instrument: InstrumentId,
    signal?: AbortSignal,
  ): Promise<InstrumentDetails> {
    return this.execute(signal, async (requestSignal) => {
      const raw = yahooQuoteBatchSchema.parse(
        await this.client.quote([toYahooSymbol(instrument)], requestSignal),
      );
      const value = raw.at(0);
      if (!value) throw new MarketDataProviderError("not_found");
      if (raw.length !== 1) throw new Error("Yahoo detail request returned multiple quotes.");
      return mapYahooInstrumentDetails(value, instrument, this.now());
    });
  }

  async getOhlcv(request: OhlcvRequest, signal?: AbortSignal): Promise<Ohlcv[]> {
    return this.execute(signal, async (requestSignal) => {
      const raw = yahooChartSchema.parse(
        await this.client.chart(
          toYahooSymbol(request.instrument),
          {
            periodStart: new Date(request.periodStart.epochMilliseconds),
            periodEnd: new Date(request.periodEnd.epochMilliseconds),
            interval: request.interval,
          },
          requestSignal,
        ),
      );
      return mapYahooChart(raw, request.instrument, request.interval);
    });
  }

  async getExchangeRates(
    request: ExchangeRateRequest,
    signal?: AbortSignal,
  ): Promise<ExchangeRateObservation[]> {
    return this.execute(signal, async (requestSignal) => {
      const raw = yahooChartSchema.parse(
        await this.client.chart(
          yahooUsdKrwSymbol,
          {
            periodStart: new Date(request.periodStart.epochMilliseconds),
            periodEnd: new Date(request.periodEnd.epochMilliseconds),
            interval: "1d",
          },
          requestSignal,
        ),
      );
      if (raw.meta.symbol !== yahooUsdKrwSymbol || raw.meta.currency !== "KRW") {
        throw new Error("Yahoo exchange-rate response has an unexpected direction.");
      }
      return mapYahooExchangeRates(raw, this.now());
    });
  }

  private async execute<T>(
    externalSignal: AbortSignal | undefined,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutSeconds * 1_000);
    const requestSignal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : timeoutSignal;
    try {
      return await operation(requestSignal);
    } catch (error) {
      throw classifyProviderError(error, timeoutSignal.aborted);
    }
  }
}
