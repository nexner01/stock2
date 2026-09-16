import { z } from "zod";

import type { Ohlcv } from "@/domain";

import { decimalStringSchema, utcIsoInstantSchema } from "./common";

export const instrumentIdDtoSchema = z
  .object({ symbol: z.string().min(1), exchange: z.string().min(1) })
  .readonly();

export const ohlcvDtoSchema = z
  .object({
    symbol: z.string().min(1),
    exchange: z.string().min(1),
    interval: z.enum(["1m", "5m", "15m", "1h", "1d"]),
    timestamp: utcIsoInstantSchema,
    open: decimalStringSchema,
    high: decimalStringSchema,
    low: decimalStringSchema,
    close: decimalStringSchema,
    adjusted_close: decimalStringSchema,
    volume: decimalStringSchema,
    currency: z.enum(["KRW", "USD"]),
    source: z.string().min(1),
  })
  .readonly();

export type OhlcvDto = z.infer<typeof ohlcvDtoSchema>;

export const toOhlcvDto = (value: Ohlcv): OhlcvDto =>
  ohlcvDtoSchema.parse({
    symbol: value.instrument.symbol,
    exchange: value.instrument.exchange,
    interval: value.interval,
    timestamp: value.timestamp.toString(),
    open: value.open.value.toString(),
    high: value.high.value.toString(),
    low: value.low.value.toString(),
    close: value.close.value.toString(),
    adjusted_close: value.adjustedClose.value.toString(),
    volume: value.volume.value.toString(),
    currency: value.currency,
    source: value.source,
  });
