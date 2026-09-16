import { z } from "zod";

import { decimalStringSchema, utcIsoInstantSchema } from "./common";

export const quoteSnapshotDtoSchema = z.object({
  symbol: z.string().min(1),
  exchange: z.string().min(1),
  name: z.string().min(1),
  currency: z.enum(["KRW", "USD"]),
  price: decimalStringSchema,
  previousClose: decimalStringSchema,
  changePercent: decimalStringSchema,
  marketStatus: z.enum(["pre", "open", "post", "closed", "holiday", "unknown"]),
  marketTimestamp: utcIsoInstantSchema,
  collectedAt: utcIsoInstantSchema,
});

export const marketGroupDtoSchema = z.object({
  id: z.enum(["indices", "popular", "watchlist", "portfolio"]),
  status: z.enum([
    "loading",
    "healthy",
    "partial",
    "delayed",
    "stale",
    "failed",
    "empty",
    "paused",
  ]),
  lastHealthyAt: utcIsoInstantSchema.nullable(),
  skipped: z.number().int().nonnegative(),
  values: z.array(quoteSnapshotDtoSchema),
});

export const marketOverviewDtoSchema = z.object({
  pollIntervalSeconds: z.number().int().min(2),
  limits: z.object({
    watchlistMaxSymbols: z.number().int().positive(),
    portfolioMaxSymbols: z.number().int().positive(),
  }),
  groups: z.array(marketGroupDtoSchema),
});

export const exchangeRateDtoSchema = z.object({
  base: z.literal("USD"),
  quote: z.literal("KRW"),
  rate: decimalStringSchema,
  marketTimestamp: utcIsoInstantSchema,
  collectedAt: utcIsoInstantSchema,
});

export const instrumentDetailDtoSchema = z.object({
  quote: quoteSnapshotDtoSchema,
  range: z.object({ start: utcIsoInstantSchema, end: utcIsoInstantSchema }).nullable(),
  interval: z.enum(["1m", "5m", "15m", "1h", "1d"]),
  ohlcv: z.array(
    z.object({
      timestamp: utcIsoInstantSchema,
      open: decimalStringSchema,
      high: decimalStringSchema,
      low: decimalStringSchema,
      close: decimalStringSchema,
      adjustedClose: decimalStringSchema,
      volume: decimalStringSchema,
    }),
  ),
});

export const instrumentSearchDtoSchema = z.array(
  quoteSnapshotDtoSchema.pick({
    symbol: true,
    exchange: true,
    name: true,
    currency: true,
    price: true,
    changePercent: true,
    marketTimestamp: true,
    collectedAt: true,
  }),
);

export type MarketOverviewDto = z.infer<typeof marketOverviewDtoSchema>;
export type InstrumentDetailDto = z.infer<typeof instrumentDetailDtoSchema>;
export type InstrumentSearchDto = z.infer<typeof instrumentSearchDtoSchema>;
export type ExchangeRateDto = z.infer<typeof exchangeRateDtoSchema>;
