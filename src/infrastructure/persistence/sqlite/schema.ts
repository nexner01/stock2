import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  collectionGroups,
  persistedCollectionStatuses,
} from "../../../ports/collection-snapshot-repository";

export const appMetadata = sqliteTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const instruments = sqliteTable(
  "instruments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    symbol: text("symbol").notNull(),
    exchange: text("exchange").notNull(),
    name: text("name").notNull(),
    currency: text("currency", { enum: ["KRW", "USD"] }).notNull(),
    kind: text("kind", { enum: ["equity", "etf", "index", "currency"] }).notNull(),
    providerSymbol: text("provider_symbol").notNull(),
  },
  (table) => [
    uniqueIndex("instruments_symbol_exchange_unique").on(table.symbol, table.exchange),
    uniqueIndex("instruments_provider_symbol_unique").on(table.providerSymbol),
  ],
);

export const ohlcvRecords = sqliteTable(
  "ohlcv_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    symbol: text("symbol").notNull(),
    exchange: text("exchange").notNull(),
    interval: text("interval", { enum: ["1m", "5m", "15m", "1h", "1d"] }).notNull(),
    timestamp: text("timestamp").notNull(),
    open: text("open").notNull(),
    high: text("high").notNull(),
    low: text("low").notNull(),
    close: text("close").notNull(),
    adjustedClose: text("adjusted_close").notNull(),
    volume: text("volume").notNull(),
    currency: text("currency", { enum: ["KRW", "USD"] }).notNull(),
    source: text("source").notNull(),
  },
  (table) => [
    uniqueIndex("ohlcv_identity_unique").on(
      table.symbol,
      table.exchange,
      table.interval,
      table.timestamp,
      table.source,
    ),
    index("ohlcv_range_lookup").on(table.symbol, table.exchange, table.interval, table.timestamp),
    check(
      "ohlcv_non_negative_values",
      sql`cast(${table.open} as real) >= 0 and cast(${table.high} as real) >= 0 and cast(${table.low} as real) >= 0 and cast(${table.close} as real) >= 0 and cast(${table.adjustedClose} as real) >= 0 and cast(${table.volume} as real) >= 0`,
    ),
    check(
      "ohlcv_price_relationships",
      sql`cast(${table.high} as real) >= cast(${table.open} as real) and cast(${table.high} as real) >= cast(${table.low} as real) and cast(${table.high} as real) >= cast(${table.close} as real) and cast(${table.low} as real) <= cast(${table.open} as real) and cast(${table.low} as real) <= cast(${table.high} as real) and cast(${table.low} as real) <= cast(${table.close} as real)`,
    ),
    check(
      "ohlcv_integer_volume",
      sql`cast(${table.volume} as real) = cast(${table.volume} as integer)`,
    ),
    check("ohlcv_utc_timestamp", sql`${table.timestamp} like '%Z'`),
  ],
);

const snapshotColumns = {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  exchange: text("exchange").notNull(),
  marketTimestamp: text("market_timestamp").notNull(),
  collectedAt: text("collected_at").notNull(),
  price: text("price").notNull(),
  previousClose: text("previous_close").notNull(),
  changePercent: text("change_percent").notNull(),
  currency: text("currency", { enum: ["KRW", "USD"] }).notNull(),
  marketStatus: text("market_status", {
    enum: ["pre", "open", "post", "closed", "holiday", "unknown"],
  }).notNull(),
  source: text("source").notNull(),
};

export const quoteSnapshots = sqliteTable("quote_snapshots", snapshotColumns, (table) => [
  uniqueIndex("quote_snapshot_identity_unique").on(
    table.symbol,
    table.exchange,
    table.marketTimestamp,
    table.source,
  ),
]);

export const indexSnapshots = sqliteTable("index_snapshots", snapshotColumns, (table) => [
  uniqueIndex("index_snapshot_identity_unique").on(
    table.symbol,
    table.exchange,
    table.marketTimestamp,
    table.source,
  ),
]);

export const collectionRuns = sqliteTable(
  "collection_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupKey: text("group_key", { enum: collectionGroups }).notNull(),
    status: text("status", { enum: persistedCollectionStatuses }).notNull(),
    marketTimestamp: text("market_timestamp"),
    collectedAt: text("collected_at").notNull(),
    payloadJson: text("payload_json").notNull(),
    validationSucceeded: integer("validation_succeeded", { mode: "boolean" }).notNull(),
    diagnosticId: text("diagnostic_id"),
  },
  (table) => [index("collection_runs_group_collected_at").on(table.groupKey, table.collectedAt)],
);

export const groupStates = sqliteTable("group_states", {
  groupKey: text("group_key", { enum: collectionGroups }).primaryKey(),
  status: text("status", { enum: persistedCollectionStatuses }).notNull(),
  updatedAt: text("updated_at").notNull(),
  diagnosticId: text("diagnostic_id"),
});

export const latestCollectionResults = sqliteTable("latest_collection_results", {
  groupKey: text("group_key", { enum: collectionGroups }).primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => collectionRuns.id),
  marketTimestamp: text("market_timestamp"),
  collectedAt: text("collected_at").notNull(),
  payloadJson: text("payload_json").notNull(),
});

export const healthySnapshots = sqliteTable("healthy_snapshots", {
  groupKey: text("group_key", { enum: collectionGroups }).primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => collectionRuns.id),
  marketTimestamp: text("market_timestamp").notNull(),
  collectedAt: text("collected_at").notNull(),
  payloadJson: text("payload_json").notNull(),
});
