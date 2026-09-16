export const collectionGroups = ["indices", "popular", "watchlist", "portfolio"] as const;
export type CollectionGroup = (typeof collectionGroups)[number];

export const persistedCollectionStatuses = [
  "loading",
  "healthy",
  "partial",
  "delayed",
  "stale",
  "failed",
  "empty",
] as const;
export type PersistedCollectionStatus = (typeof persistedCollectionStatuses)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type CollectionResultRecord = Readonly<{
  group: CollectionGroup;
  status: PersistedCollectionStatus;
  marketTimestamp: string | null;
  collectedAt: string;
  payload: JsonValue;
  validationSucceeded: boolean;
  diagnosticId: string | null;
}>;

export type StoredCollectionResult = CollectionResultRecord & Readonly<{ runId: number }>;

export interface CollectionSnapshotRepository {
  save(result: CollectionResultRecord): Promise<void>;
  getLatest(group: CollectionGroup): Promise<StoredCollectionResult | null>;
  getLastHealthy(group: CollectionGroup): Promise<StoredCollectionResult | null>;
}
