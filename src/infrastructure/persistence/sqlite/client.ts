import "server-only";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { readRawEnvironment } from "@/config";

import * as schema from "./schema";

export type Stock2Database = BetterSQLite3Database<typeof schema>;

let database: Stock2Database | undefined;

export const getDatabase = (): Stock2Database => {
  if (database) return database;
  const environment = readRawEnvironment();
  const sqlite = new Database(environment.databaseUrl ?? "./data/stock2.db");
  sqlite.pragma("journal_mode = WAL");
  database = drizzle(sqlite, { schema });
  return database;
};
