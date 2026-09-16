import { z } from "zod";

import { decimalStringSchema } from "./common";

export const analysisPeriodSchema = z.enum(["6m", "1y", "3y", "5y", "7y", "10y"]);
export const portfolioAnalysisRequestSchema = z.object({
  period: analysisPeriodSchema,
  strategy: z.enum(["common-period", "exclude-short-history", "cancel"]),
  holdings: z
    .array(
      z.object({
        symbol: z.string().min(1),
        exchange: z.string().min(1),
        quantity: decimalStringSchema,
      }),
    )
    .min(1),
});
export const portfolioAnalysisDtoSchema = z.object({
  status: z.enum(["completed", "cancelled"]),
  requestedStart: z.string(),
  actualStart: z.string().nullable(),
  endDate: z.string(),
  affected: z.array(z.object({ symbol: z.string(), firstAvailableDate: z.string() })),
  excluded: z.array(z.object({ symbol: z.string(), reason: z.literal("short-history") })),
  values: z.array(z.object({ date: z.string(), valueKrw: decimalStringSchema })),
  appliedExchangeRateDates: z.record(z.string(), z.string()),
});
export const recommendationDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  assets: z.array(
    z.object({
      symbol: z.string(),
      exchange: z.string(),
      weight: decimalStringSchema,
      quantity: decimalStringSchema,
    }),
  ),
  metrics: z.object({
    cumulativeReturn: decimalStringSchema,
    cagr: decimalStringSchema.nullable(),
    annualizedVolatility: decimalStringSchema,
    maximumDrawdown: decimalStringSchema,
    peakDate: z.string(),
    troughDate: z.string(),
  }),
  assumptions: z.object({
    initialKrw: z.literal("10000000"),
    adjustedClose: z.literal(true),
    dividendReinvestment: z.literal(true),
    rebalancing: z.literal("monthly"),
    fractionalShares: z.literal(true),
    feesKrw: z.literal("0"),
    taxesKrw: z.literal("0"),
  }),
});
export const recommendationsDtoSchema = z.array(recommendationDtoSchema);
export type PortfolioAnalysisDto = z.infer<typeof portfolioAnalysisDtoSchema>;
export type RecommendationDto = z.infer<typeof recommendationDtoSchema>;
