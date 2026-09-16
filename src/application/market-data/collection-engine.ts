import { Temporal } from "@js-temporal/polyfill";

import type { InstrumentId, MarketStatus, QuoteSnapshot } from "@/domain";
import type {
  Clock,
  CollectionGroup,
  CollectionSnapshotRepository,
  JsonValue,
  MarketDataProvider,
  ScheduledHandle,
  Scheduler,
} from "@/ports";

export type CollectionGroupDefinition = Readonly<{
  id: CollectionGroup;
  getInstruments: () => readonly InstrumentId[];
  getMarketStatus: () => MarketStatus;
}>;

export type CollectionGroupMetrics = Readonly<{
  attempts: number;
  successes: number;
  failures: number;
  skipped: number;
  partial: number;
}>;

export type CollectionGroupRuntimeState = Readonly<{
  id: CollectionGroup;
  status: "loading" | "healthy" | "partial" | "delayed" | "failed" | "empty" | "paused";
  consecutiveFailures: number;
  stopped: boolean;
  inFlight: boolean;
  t0: Temporal.Instant;
  nextDueAt: Temporal.Instant | null;
  lastStartedAt: Temporal.Instant | null;
  lastCompletedAt: Temporal.Instant | null;
  lastHealthyAt: Temporal.Instant | null;
  values: readonly QuoteSnapshot[];
  metrics: CollectionGroupMetrics;
}>;

export interface CollectionEngineLogger {
  info(record: Readonly<Record<string, unknown>>, message: string): void;
  warn(record: Readonly<Record<string, unknown>>, message: string): void;
}

type MutableGroup = {
  definition: CollectionGroupDefinition;
  generation: number;
  sequence: number;
  status: CollectionGroupRuntimeState["status"];
  consecutiveFailures: number;
  stopped: boolean;
  inFlight: boolean;
  t0: Temporal.Instant;
  nextDueAt: Temporal.Instant | null;
  lastStartedAt: Temporal.Instant | null;
  lastCompletedAt: Temporal.Instant | null;
  lastHealthyAt: Temporal.Instant | null;
  values: QuoteSnapshot[];
  metrics: {
    attempts: number;
    successes: number;
    failures: number;
    skipped: number;
    partial: number;
  };
  scheduled: ScheduledHandle | null;
};

export type CollectionEngineOptions = Readonly<{
  intervalSeconds: number;
  timeoutSeconds: number;
  batchSize: number;
  retryCount: number;
}>;

const isMarketOpen = (status: MarketStatus): boolean =>
  status === "open" || status === "pre" || status === "post";

const toPayload = (values: readonly QuoteSnapshot[]): JsonValue => ({
  values: values.map((value) => ({
    symbol: value.instrument.symbol,
    exchange: value.instrument.exchange,
    price: value.price.value.toString(),
    currency: value.currency,
    marketTimestamp: value.marketTimestamp.toString(),
    collectedAt: value.collectedAt.toString(),
    source: value.source,
  })),
});

const splitBatches = <T>(values: readonly T[], size: number): readonly (readonly T[])[] => {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
};

export class FixedTimeCollectionEngine {
  private readonly groups = new Map<CollectionGroup, MutableGroup>();
  private started = false;

  constructor(
    definitions: readonly CollectionGroupDefinition[],
    private readonly provider: MarketDataProvider,
    private readonly repository: CollectionSnapshotRepository,
    private readonly clock: Clock,
    private readonly scheduler: Scheduler,
    private readonly logger: CollectionEngineLogger,
    private readonly options: CollectionEngineOptions,
  ) {
    if (definitions.length !== 4 || new Set(definitions.map(({ id }) => id)).size !== 4) {
      throw new Error("Collection engine requires four distinct group definitions.");
    }
    if (
      !Number.isInteger(options.intervalSeconds) ||
      options.intervalSeconds < 2 ||
      !Number.isInteger(options.timeoutSeconds) ||
      options.timeoutSeconds < 1 ||
      !Number.isInteger(options.batchSize) ||
      options.batchSize < 1 ||
      !Number.isInteger(options.retryCount) ||
      options.retryCount < 0
    ) {
      throw new Error("Invalid collection engine options.");
    }
    const t0 = clock.now();
    for (const definition of definitions) {
      this.groups.set(definition.id, {
        definition,
        generation: 0,
        sequence: 0,
        status: "loading",
        consecutiveFailures: 0,
        stopped: false,
        inFlight: false,
        t0,
        nextDueAt: null,
        lastStartedAt: null,
        lastCompletedAt: null,
        lastHealthyAt: null,
        values: [],
        metrics: { attempts: 0, successes: 0, failures: 0, skipped: 0, partial: 0 },
        scheduled: null,
      });
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const t0 = this.clock.now();
    for (const group of this.groups.values()) this.rebaseAndSchedule(group, t0, true);
  }

  stop(): void {
    this.started = false;
    for (const group of this.groups.values()) {
      group.generation += 1;
      group.scheduled?.cancel();
      group.scheduled = null;
      group.nextDueAt = null;
    }
  }

  state(groupId: CollectionGroup): CollectionGroupRuntimeState {
    const group = this.requireGroup(groupId);
    return Object.freeze({
      id: group.definition.id,
      status: group.status,
      consecutiveFailures: group.consecutiveFailures,
      stopped: group.stopped,
      inFlight: group.inFlight,
      t0: group.t0,
      nextDueAt: group.nextDueAt,
      lastStartedAt: group.lastStartedAt,
      lastCompletedAt: group.lastCompletedAt,
      lastHealthyAt: group.lastHealthyAt,
      values: [...group.values],
      metrics: Object.freeze({ ...group.metrics }),
    });
  }

  retryGroup(groupId: CollectionGroup): void {
    const group = this.requireGroup(groupId);
    group.stopped = false;
    group.consecutiveFailures = 0;
    group.status = "loading";
    if (this.started) this.rebaseAndSchedule(group, this.clock.now(), false);
  }

  resetAll(): void {
    for (const group of this.groups.values()) {
      group.stopped = false;
      group.consecutiveFailures = 0;
      group.status = "loading";
      if (this.started) this.rebaseAndSchedule(group, this.clock.now(), false);
    }
  }

  async runManualQuery(instruments: readonly InstrumentId[]): Promise<readonly QuoteSnapshot[]> {
    return this.provider.getQuotes(instruments);
  }

  private rebaseAndSchedule(group: MutableGroup, t0: Temporal.Instant, immediate: boolean): void {
    group.generation += 1;
    group.scheduled?.cancel();
    group.t0 = t0;
    group.sequence = immediate ? 0 : 1;
    const dueAt = immediate
      ? t0
      : t0.add({ seconds: this.options.intervalSeconds * group.sequence });
    this.scheduleTick(group, dueAt, group.generation);
  }

  private scheduleTick(group: MutableGroup, dueAt: Temporal.Instant, generation: number): void {
    group.nextDueAt = dueAt;
    group.scheduled = this.scheduler.scheduleAt(dueAt, () => {
      if (!this.started || generation !== group.generation) return;
      group.sequence += 1;
      const nextDueAt = group.t0.add({ seconds: this.options.intervalSeconds * group.sequence });
      this.scheduleTick(group, nextDueAt, generation);
      void this.runTick(group);
    });
  }

  private async runTick(group: MutableGroup): Promise<void> {
    const now = this.clock.now();
    const marketStatus = group.definition.getMarketStatus();
    if (!isMarketOpen(marketStatus)) {
      group.status = "paused";
      return;
    }
    if (group.status === "paused") {
      this.rebaseAndSchedule(group, now, false);
    }
    if (group.stopped) return;
    if (group.inFlight) {
      group.metrics.skipped += 1;
      this.logger.warn(
        { group: group.definition.id, skipped: group.metrics.skipped, dueAt: now.toString() },
        "이전 수집 요청이 진행 중이어서 회차를 건너뜁니다.",
      );
      return;
    }

    const instruments = group.definition.getInstruments();
    if (instruments.length === 0) {
      group.status = "empty";
      group.lastCompletedAt = now;
      await this.repository.save({
        group: group.definition.id,
        status: "empty",
        marketTimestamp: null,
        collectedAt: now.toString(),
        payload: { values: [] },
        validationSucceeded: false,
        diagnosticId: null,
      });
      return;
    }

    group.inFlight = true;
    group.status = "loading";
    group.lastStartedAt = now;
    group.metrics.attempts += 1;
    const controller = new AbortController();
    let timedOut = false;
    const timeoutAt = now.add({ seconds: this.options.timeoutSeconds });
    const timeout = this.scheduler.scheduleAt(timeoutAt, () => {
      timedOut = true;
      controller.abort(new DOMException("Collection timed out.", "AbortError"));
    });
    this.logger.info(
      { group: group.definition.id, startedAt: now.toString(), symbolCount: instruments.length },
      "그룹 수집을 시작합니다.",
    );

    const batches = splitBatches(instruments, this.options.batchSize);
    const settled = await Promise.allSettled(
      batches.map((batch) =>
        group.definition.id === "indices"
          ? this.provider.getIndices(batch, controller.signal)
          : this.provider.getQuotes(batch, controller.signal),
      ),
    );
    timeout.cancel();
    const completedAt = this.clock.now();
    const successes = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const failureCount = settled.filter((result) => result.status === "rejected").length;
    group.inFlight = false;
    group.lastCompletedAt = completedAt;
    group.values = successes;

    if (failureCount === 0) {
      group.status = "healthy";
      group.consecutiveFailures = 0;
      group.metrics.successes += 1;
      group.lastHealthyAt = completedAt;
      await this.persist(group, "healthy", true, null);
    } else if (successes.length > 0) {
      group.status = "partial";
      group.consecutiveFailures += 1;
      group.metrics.partial += 1;
      group.metrics.failures += 1;
      await this.persist(group, "partial", false, timedOut ? "timeout" : "batch-failure");
      this.stopAfterRetryLimit(group);
    } else {
      group.status = timedOut ? "delayed" : "failed";
      group.consecutiveFailures += 1;
      group.metrics.failures += 1;
      await this.persist(
        group,
        timedOut ? "delayed" : "failed",
        false,
        timedOut ? "timeout" : "provider-failure",
      );
      this.stopAfterRetryLimit(group);
    }

    this.logger.info(
      {
        group: group.definition.id,
        completedAt: completedAt.toString(),
        durationMs: completedAt.epochMilliseconds - now.epochMilliseconds,
        successfulBatches: settled.length - failureCount,
        failedBatches: failureCount,
      },
      "그룹 수집을 완료했습니다.",
    );
  }

  private stopAfterRetryLimit(group: MutableGroup): void {
    if (group.consecutiveFailures > this.options.retryCount) {
      group.stopped = true;
      group.status = "failed";
    }
  }

  private async persist(
    group: MutableGroup,
    status: "healthy" | "partial" | "delayed" | "failed",
    validationSucceeded: boolean,
    diagnosticId: string | null,
  ): Promise<void> {
    const marketTimestamp = group.values.reduce<Temporal.Instant | null>(
      (latest, value) =>
        !latest || Temporal.Instant.compare(value.marketTimestamp, latest) > 0
          ? value.marketTimestamp
          : latest,
      null,
    );
    await this.repository.save({
      group: group.definition.id,
      status,
      marketTimestamp: marketTimestamp?.toString() ?? null,
      collectedAt: (group.lastCompletedAt ?? this.clock.now()).toString(),
      payload: toPayload(group.values),
      validationSucceeded,
      diagnosticId,
    });
  }

  private requireGroup(groupId: CollectionGroup): MutableGroup {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`Unknown collection group: ${groupId}`);
    return group;
  }
}
