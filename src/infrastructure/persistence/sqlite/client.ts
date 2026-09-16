import "server-only";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { readRawEnvironment } from "@/config";

let database: BetterSQLite3Database | undefined;

export const getDatabase = (): BetterSQLite3Database => {
  if (database) return database;
  const environment = readRawEnvironment();
  const sqlite = new Database(environment.databaseUrl ?? "./data/stock2.db");
  sqlite.pragma("journal_mode = WAL");
  database = drizzle(sqlite);
  return database;
};
