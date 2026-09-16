import { z } from "zod";

const providerDateSchema = z
  .union([z.date(), z.string().datetime({ offset: true })])
  .transform((value) => (value instanceof Date ? value : new Date(value)));

export const yahooQuoteSchema = z
  .object({
    symbol: z.string().min(1),
    shortName: z.string().min(1).optional(),
    longName: z.string().min(1).optional(),
    quoteType: z.enum(["EQUITY", "ETF", "INDEX", "CURRENCY"]),
    currency: z.enum(["KRW", "USD"]),
    exchange: z.string().min(1),
    fullExchangeName: z.string().min(1).optional(),
    exchangeTimezoneName: z.string().min(1),
    marketState: z.enum(["REGULAR", "CLOSED", "PRE", "PREPRE", "POST", "POSTPOST"]),
    regularMarketPrice: z.number().finite().nonnegative(),
    regularMarketPreviousClose: z.number().finite().nonnegative(),
    regularMarketChangePercent: z.number().finite(),
    regularMarketTime: providerDateSchema,
    firstTradeDateMilliseconds: providerDateSchema.optional(),
  })
  .passthrough();

export const yahooQuoteBatchSchema = z.array(yahooQuoteSchema);

export const yahooChartSchema = z
  .object({
    meta: z
      .object({
        symbol: z.string().min(1),
        currency: z.enum(["KRW", "USD"]),
        exchangeName: z.string().min(1),
        regularMarketTime: providerDateSchema,
      })
      .passthrough(),
    quotes: z.array(
      z
        .object({
          date: providerDateSchema,
          open: z.number().finite().nonnegative(),
          high: z.number().finite().nonnegative(),
          low: z.number().finite().nonnegative(),
          close: z.number().finite().nonnegative(),
          adjclose: z.number().finite().nonnegative(),
          volume: z.number().int().nonnegative(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const yahooSearchSchema = z
  .object({
    quotes: z.array(
      z.union([
        z
          .object({
            symbol: z.string().min(1),
            isYahooFinance: z.literal(true),
            exchange: z.string().min(1),
            shortname: z.string().min(1).optional(),
            longname: z.string().min(1).optional(),
            quoteType: z.string().min(1),
          })
          .passthrough(),
        z.object({ isYahooFinance: z.literal(false) }).passthrough(),
      ]),
    ),
  })
  .passthrough();

export type YahooQuote = z.infer<typeof yahooQuoteSchema>;
export type YahooChart = z.infer<typeof yahooChartSchema>;
export type YahooSearch = z.infer<typeof yahooSearchSchema>;
