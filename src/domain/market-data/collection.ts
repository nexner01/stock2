import type { Temporal } from "@js-temporal/polyfill";

export type DataRange = Readonly<{
  start: Temporal.Instant;
  end: Temporal.Instant;
}>;

export type DataGap = Readonly<{
  start: Temporal.Instant;
  end: Temporal.Instant;
  reason: "missing" | "providerUnavailable" | "beforeListing";
}>;

export type GroupStatus =
  | Readonly<{ kind: "loading"; startedAt: Temporal.Instant }>
  | Readonly<{ kind: "healthy"; completedAt: Temporal.Instant }>
  | Readonly<{ kind: "partial"; completedAt: Temporal.Instant; failedBatchCount: number }>
  | Readonly<{
      kind: "delayed";
      detectedAt: Temporal.Instant;
      lastHealthyAt: Temporal.Instant | null;
      timeoutSeconds: number;
    }>
  | Readonly<{ kind: "stale"; detectedAt: Temporal.Instant; lastHealthyAt: Temporal.Instant }>
  | Readonly<{
      kind: "failed";
      failedAt: Temporal.Instant;
      retryable: boolean;
      diagnosticId: string;
    }>
  | Readonly<{ kind: "empty"; checkedAt: Temporal.Instant }>;

export type BatchResult<T> =
  | Readonly<{ kind: "success"; batchIndex: number; values: readonly T[] }>
  | Readonly<{
      kind: "failure";
      batchIndex: number;
      requestedSymbols: readonly string[];
      code: string;
    }>;

export type CollectionAttempt<T> = Readonly<{
  status: GroupStatus;
  marketTimestamp: Temporal.Instant | null;
  collectedAt: Temporal.Instant;
  values: readonly T[];
  batches: readonly BatchResult<T>[];
  range: DataRange | null;
  gaps: readonly DataGap[];
}>;

export type HealthySnapshot<T> = Readonly<{
  marketTimestamp: Temporal.Instant;
  collectedAt: Temporal.Instant;
  values: readonly T[];
  range: DataRange | null;
  gaps: readonly DataGap[];
}>;

export type DataEnvelope<T> = Readonly<{
  latest: CollectionAttempt<T>;
  lastHealthy: HealthySnapshot<T> | null;
}>;
