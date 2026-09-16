import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";

import type { Currency, InstrumentId, Interval } from "../instruments";
import { createAmount, type DecimalAmount } from "../numbers";
import { parseUtcInstant } from "../time";

export type OhlcvInput = Readonly<{
  instrument: InstrumentId;
  interval: Interval;
  timestamp: string | Temporal.Instant;
  open: Decimal.Value;
  high: Decimal.Value;
  low: Decimal.Value;
  close: Decimal.Value;
  adjustedClose: Decimal.Value;
  volume: Decimal.Value;
  currency: Currency;
  source: string;
}>;

export type Ohlcv = Readonly<{
  instrument: InstrumentId;
  interval: Interval;
  timestamp: Temporal.Instant;
  open: DecimalAmount<"price">;
  high: DecimalAmount<"price">;
  low: DecimalAmount<"price">;
  close: DecimalAmount<"price">;
  adjustedClose: DecimalAmount<"price">;
  volume: DecimalAmount<"quantity">;
  currency: Currency;
  source: string;
}>;

export const createOhlcv = (input: OhlcvInput): Ohlcv => {
  const timestamp =
    typeof input.timestamp === "string" ? parseUtcInstant(input.timestamp) : input.timestamp;
  const open = createAmount("price", input.open);
  const high = createAmount("price", input.high);
  const low = createAmount("price", input.low);
  const close = createAmount("price", input.close);
  const adjustedClose = createAmount("price", input.adjustedClose);
  const volume = createAmount("quantity", input.volume);
  const source = input.source.trim();

  if (source.length === 0) throw new Error("OHLCV source is required.");
  if ([open, high, low, close, adjustedClose].some(({ value }) => value.isNegative())) {
    throw new Error("OHLCV prices cannot be negative.");
  }
  if (volume.value.isNegative() || !volume.value.isInteger()) {
    throw new Error("OHLCV volume must be a non-negative integer.");
  }
  if (high.value.lessThan(Decimal.max(open.value, low.value, close.value))) {
    throw new Error("OHLCV high must be greater than or equal to open, low, and close.");
  }
  if (low.value.greaterThan(Decimal.min(open.value, high.value, close.value))) {
    throw new Error("OHLCV low must be less than or equal to open, high, and close.");
  }

  return Object.freeze({
    instrument: input.instrument,
    interval: input.interval,
    timestamp,
    open,
    high,
    low,
    close,
    adjustedClose,
    volume,
    currency: input.currency,
    source,
  });
};

export const ohlcvIdentityKey = (value: Ohlcv): string =>
  [
    value.instrument.symbol,
    value.instrument.exchange,
    value.interval,
    value.timestamp.toString(),
    value.source,
  ].join("|");
