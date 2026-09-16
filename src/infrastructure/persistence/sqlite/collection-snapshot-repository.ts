import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { parseUtcInstant } from "@/domain";
import type {
  CollectionGroup,
  CollectionResultRecord,
  CollectionSnapshotRepository,
  StoredCollectionResult,
} from "@/ports";

import type { Stock2Database } from "./client";
import { collectionRuns, groupStates, healthySnapshots, latestCollectionResults } from "./schema";

const jsonValueSchema = z.json();

type StoredRow = Readonly<{
  runId: number;
  group: CollectionGroup;
  status: StoredCollectionResult["status"];
  marketTimestamp: string | null;
  collectedAt: string;
  payloadJson: string;
  validationSucceeded: boolean;
  diagnosticId: string | null;
}>;

const toStoredResult = (row: StoredRow): StoredCollectionResult => ({
  runId: row.runId,
  group: row.group,
  status: row.status,
  marketTimestamp: row.marketTimestamp,
  collectedAt: row.collectedAt,
  payload: jsonValueSchema.parse(JSON.parse(row.payloadJson)),
  validationSucceeded: row.validationSucceeded,
  diagnosticId: row.diagnosticId,
});

export class SqliteCollectionSnapshotRepository implements CollectionSnapshotRepository {
  constructor(private readonly database: Stock2Database) {}

  async save(result: CollectionResultRecord): Promise<void> {
    const payloadJson = JSON.stringify(result.payload);
    const collectedAt = parseUtcInstant(result.collectedAt).toString();
    const marketTimestamp = result.marketTimestamp
      ? parseUtcInstant(result.marketTimestamp).toString()
      : null;

    this.database.transaction((transaction) => {
      const run = transaction
        .insert(collectionRuns)
        .values({
          groupKey: result.group,
          status: result.status,
          marketTimestamp,
          collectedAt,
          payloadJson,
          validationSucceeded: result.validationSucceeded,
          diagnosticId: result.diagnosticId,
        })
        .returning({ id: collectionRuns.id })
        .get();

      transaction
        .insert(groupStates)
        .values({
          groupKey: result.group,
          status: result.status,
          updatedAt: collectedAt,
          diagnosticId: result.diagnosticId,
        })
        .onConflictDoUpdate({
          target: groupStates.groupKey,
          set: {
            status: result.status,
            updatedAt: collectedAt,
            diagnosticId: result.diagnosticId,
          },
        })
        .run();

      transaction
        .insert(latestCollectionResults)
        .values({
          groupKey: result.group,
          runId: run.id,
          marketTimestamp,
          collectedAt,
          payloadJson,
        })
        .onConflictDoUpdate({
          target: latestCollectionResults.groupKey,
          set: {
            runId: run.id,
            marketTimestamp,
            collectedAt,
            payloadJson,
          },
        })
        .run();

      if (result.validationSucceeded && result.status === "healthy" && marketTimestamp) {
        transaction
          .insert(healthySnapshots)
          .values({
            groupKey: result.group,
            runId: run.id,
            marketTimestamp,
            collectedAt,
            payloadJson,
          })
          .onConflictDoUpdate({
            target: healthySnapshots.groupKey,
            set: {
              runId: run.id,
              marketTimestamp,
              collectedAt,
              payloadJson,
            },
          })
          .run();
      }
    });
  }

  async getLatest(group: CollectionGroup): Promise<StoredCollectionResult | null> {
    const row = this.database
      .select({
        runId: collectionRuns.id,
        group: collectionRuns.groupKey,
        status: collectionRuns.status,
        marketTimestamp: collectionRuns.marketTimestamp,
        collectedAt: collectionRuns.collectedAt,
        payloadJson: latestCollectionResults.payloadJson,
        validationSucceeded: collectionRuns.validationSucceeded,
        diagnosticId: collectionRuns.diagnosticId,
      })
      .from(latestCollectionResults)
      .innerJoin(collectionRuns, eq(latestCollectionResults.runId, collectionRuns.id))
      .where(eq(latestCollectionResults.groupKey, group))
      .get();

    return row ? toStoredResult(row) : null;
  }

  async getLastHealthy(group: CollectionGroup): Promise<StoredCollectionResult | null> {
    const row = this.database
      .select({
        runId: collectionRuns.id,
        group: collectionRuns.groupKey,
        status: collectionRuns.status,
        marketTimestamp: collectionRuns.marketTimestamp,
        collectedAt: collectionRuns.collectedAt,
        payloadJson: healthySnapshots.payloadJson,
        validationSucceeded: collectionRuns.validationSucceeded,
        diagnosticId: collectionRuns.diagnosticId,
      })
      .from(healthySnapshots)
      .innerJoin(collectionRuns, eq(healthySnapshots.runId, collectionRuns.id))
      .where(eq(healthySnapshots.groupKey, group))
      .get();

    return row ? toStoredResult(row) : null;
  }
}
