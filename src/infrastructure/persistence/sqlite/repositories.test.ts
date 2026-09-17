// @vitest-environment node

import { resolve } from "node:path";

import { Temporal } from "@js-temporal/polyfill";
import Database from "better-sqlite3";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createInstrumentId, createOhlcv } from "@/domain";

import { SqliteCollectionSnapshotRepository } from "./collection-snapshot-repository";
import type { Stock2Database } from "./client";
import { SqliteOhlcvRepository } from "./ohlcv-repository";
import { appMetadata, collectionRuns, ohlcvRecords } from "./schema";
import * as schema from "./schema";

describe("SQLite market-data repositories", () => {
  let sqlite: InstanceType<typeof Database>;
  let database: Stock2Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    database = drizzle(sqlite, { schema });
    migrate(database, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  });

  afterEach(() => sqlite.close());

  it("applies the M3 migration to a clean database", () => {
    const tables = sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all()
      .map((row) => {
        if (typeof row !== "object" || row === null || !("name" in row)) return null;
        return typeof row.name === "string" ? row.name : null;
      });

    expect(tables).toEqual(
      expect.arrayContaining([
        "instruments",
        "ohlcv_records",
        "quote_snapshots",
        "index_snapshots",
        "collection_runs",
        "group_states",
        "latest_collection_results",
        "healthy_snapshots",
      ]),
    );
  });

  it("upgrades an M1 fixture database without losing existing data", () => {
    const legacySqlite = new Database(":memory:");
    try {
      const migrationsFolder = resolve(process.cwd(), "drizzle");
      const [initialMigration] = readMigrationFiles({ migrationsFolder });
      if (!initialMigration) throw new Error("initial migration fixture is missing");
      for (const statement of initialMigration.sql) legacySqlite.exec(statement);
      legacySqlite.exec(
        "CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
      );
      legacySqlite
        .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
        .run(initialMigration.hash, initialMigration.folderMillis);
      legacySqlite
        .prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)")
        .run("fixture-version", "m1");

      const legacyDatabase = drizzle(legacySqlite, { schema });
      migrate(legacyDatabase, { migrationsFolder });

      expect(legacyDatabase.select().from(appMetadata).all()).toContainEqual({
        key: "fixture-version",
        value: "m1",
      });
      expect(
        legacySqlite
          .prepare("select name from sqlite_master where type = 'table' and name = 'ohlcv_records'")
          .get(),
      ).toBeDefined();
    } finally {
      legacySqlite.close();
    }
  });

  it("keeps the latest failed result separate from the last healthy snapshot", async () => {
    const repository = new SqliteCollectionSnapshotRepository(database);
    await repository.save({
      group: "indices",
      status: "healthy",
      marketTimestamp: "2026-09-16T00:00:00Z",
      collectedAt: "2026-09-16T00:00:01Z",
      payload: { values: ["KOSPI"] },
      validationSucceeded: true,
      diagnosticId: null,
    });
    const healthy = await repository.getLastHealthy("indices");

    await repository.save({
      group: "indices",
      status: "failed",
      marketTimestamp: null,
      collectedAt: "2026-09-16T00:00:03Z",
      payload: { failed: true },
      validationSucceeded: false,
      diagnosticId: "diag-1",
    });

    expect(await repository.getLatest("indices")).toMatchObject({
      status: "failed",
      payload: { failed: true },
      diagnosticId: "diag-1",
    });
    expect(await repository.getLastHealthy("indices")).toEqual(healthy);
    const runCount = database.select({ value: count() }).from(collectionRuns).get();
    expect(runCount?.value).toBe(2);
  });

  it("does not replace a healthy snapshot until full validation succeeds", async () => {
    const repository = new SqliteCollectionSnapshotRepository(database);
    await repository.save({
      group: "popular",
      status: "healthy",
      marketTimestamp: "2026-09-16T00:00:00Z",
      collectedAt: "2026-09-16T00:00:01Z",
      payload: { version: 1 },
      validationSucceeded: true,
      diagnosticId: null,
    });
    await repository.save({
      group: "popular",
      status: "healthy",
      marketTimestamp: "2026-09-16T00:00:02Z",
      collectedAt: "2026-09-16T00:00:03Z",
      payload: { version: 2 },
      validationSucceeded: false,
      diagnosticId: "validation-failed",
    });

    expect(await repository.getLatest("popular")).toMatchObject({ payload: { version: 2 } });
    expect(await repository.getLastHealthy("popular")).toMatchObject({ payload: { version: 1 } });
  });

  it("rejects non-UTC collection timestamps before opening the transaction", async () => {
    const repository = new SqliteCollectionSnapshotRepository(database);
    await expect(
      repository.save({
        group: "watchlist",
        status: "healthy",
        marketTimestamp: "2026-09-16T09:00:00+09:00",
        collectedAt: "2026-09-16T09:00:01+09:00",
        payload: { version: 1 },
        validationSucceeded: true,
        diagnosticId: null,
      }),
    ).rejects.toThrow("UTC instant must end in Z");
    const runCount = database.select({ value: count() }).from(collectionRuns).get();
    expect(runCount?.value).toBe(0);
  });

  it("upserts OHLCV by its composite identity and returns UTC ordered values", async () => {
    const repository = new SqliteOhlcvRepository(database);
    const instrument = createInstrumentId("AAPL", "XNAS");
    const first = createOhlcv({
      instrument,
      interval: "1d",
      timestamp: "2026-09-15T20:00:00Z",
      open: "229.5",
      high: "232.1",
      low: "228.7",
      close: "231.45",
      adjustedClose: "231.45",
      volume: "48901234",
      currency: "USD",
      source: "yahoo-finance",
    });
    const second = createOhlcv({
      ...first,
      timestamp: Temporal.Instant.from("2026-09-16T20:00:00Z"),
      open: "231",
      high: "233",
      low: "230",
      close: "232",
      adjustedClose: "232",
      volume: "40000000",
    });

    await repository.saveMany([second, first, first]);
    const values = await repository.findRange({
      instrument,
      interval: "1d",
      start: "2026-09-01T00:00:00Z",
      end: "2026-09-30T00:00:00Z",
      source: "yahoo-finance",
    });

    expect(values.map((value) => value.timestamp.toString())).toEqual([
      "2026-09-15T20:00:00Z",
      "2026-09-16T20:00:00Z",
    ]);
    const recordCount = database.select({ value: count() }).from(ohlcvRecords).get();
    expect(recordCount?.value).toBe(2);
  });

  it("enforces negative, integer-volume, and OHLC relationship constraints in SQLite", () => {
    const base = {
      symbol: "AAPL",
      exchange: "XNAS",
      interval: "1d" as const,
      timestamp: "2026-09-15T20:00:00Z",
      open: "100",
      high: "110",
      low: "90",
      close: "105",
      adjustedClose: "105",
      volume: "1000",
      currency: "USD" as const,
      source: "yahoo-finance",
    };

    expect(() =>
      database
        .insert(ohlcvRecords)
        .values({ ...base, volume: "-1" })
        .run(),
    ).toThrow();
    expect(() =>
      database
        .insert(ohlcvRecords)
        .values({ ...base, timestamp: "2026-09-16T20:00:00Z", volume: "1.5" })
        .run(),
    ).toThrow();
    expect(() =>
      database
        .insert(ohlcvRecords)
        .values({ ...base, timestamp: "2026-09-17T20:00:00Z", high: "80" })
        .run(),
    ).toThrow();
  });
});
