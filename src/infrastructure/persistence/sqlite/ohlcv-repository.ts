import "server-only";

import { and, asc, eq, gte, lte } from "drizzle-orm";

import { createInstrumentId, createOhlcv, parseUtcInstant, type Ohlcv } from "@/domain";
import type { OhlcvRangeQuery, OhlcvRepository } from "@/ports";

import type { Stock2Database } from "./client";
import { ohlcvRecords } from "./schema";

export class SqliteOhlcvRepository implements OhlcvRepository {
  constructor(private readonly database: Stock2Database) {}

  async saveMany(values: readonly Ohlcv[]): Promise<void> {
    this.database.transaction((transaction) => {
      for (const value of values) {
        transaction
          .insert(ohlcvRecords)
          .values({
            symbol: value.instrument.symbol,
            exchange: value.instrument.exchange,
            interval: value.interval,
            timestamp: value.timestamp.toString(),
            open: value.open.value.toString(),
            high: value.high.value.toString(),
            low: value.low.value.toString(),
            close: value.close.value.toString(),
            adjustedClose: value.adjustedClose.value.toString(),
            volume: value.volume.value.toString(),
            currency: value.currency,
            source: value.source,
          })
          .onConflictDoUpdate({
            target: [
              ohlcvRecords.symbol,
              ohlcvRecords.exchange,
              ohlcvRecords.interval,
              ohlcvRecords.timestamp,
              ohlcvRecords.source,
            ],
            set: {
              open: value.open.value.toString(),
              high: value.high.value.toString(),
              low: value.low.value.toString(),
              close: value.close.value.toString(),
              adjustedClose: value.adjustedClose.value.toString(),
              volume: value.volume.value.toString(),
              currency: value.currency,
            },
          })
          .run();
      }
    });
  }

  async findRange(query: OhlcvRangeQuery): Promise<Ohlcv[]> {
    const start = parseUtcInstant(query.start).toString();
    const end = parseUtcInstant(query.end).toString();
    const rows = this.database
      .select()
      .from(ohlcvRecords)
      .where(
        and(
          eq(ohlcvRecords.symbol, query.instrument.symbol),
          eq(ohlcvRecords.exchange, query.instrument.exchange),
          eq(ohlcvRecords.interval, query.interval),
          eq(ohlcvRecords.source, query.source),
          gte(ohlcvRecords.timestamp, start),
          lte(ohlcvRecords.timestamp, end),
        ),
      )
      .orderBy(asc(ohlcvRecords.timestamp))
      .all();

    return rows.map((row) =>
      createOhlcv({
        instrument: createInstrumentId(row.symbol, row.exchange),
        interval: row.interval,
        timestamp: row.timestamp,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        adjustedClose: row.adjustedClose,
        volume: row.volume,
        currency: row.currency,
        source: row.source,
      }),
    );
  }
}
