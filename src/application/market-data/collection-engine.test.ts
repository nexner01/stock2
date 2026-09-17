// @vitest-environment node

import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";

import {
  createAmount,
  createInstrumentId,
  type ExchangeRateObservation,
  type InstrumentDetails,
  type InstrumentId,
  type InstrumentSearchResult,
  type MarketStatus,
  type Ohlcv,
  type QuoteSnapshot,
} from "@/domain";
import type {
  Clock,
  CollectionGroup,
  CollectionResultRecord,
  CollectionSnapshotRepository,
  MarketDataProvider,
  ScheduledHandle,
  ScheduledTask,
  Scheduler,
  StoredCollectionResult,
} from "@/ports";

import {
  FixedTimeCollectionEngine,
  type CollectionEngineLogger,
  type CollectionGroupDefinition,
} from "./collection-engine";

type Task = { at: Temporal.Instant; active: boolean; task: ScheduledTask };

class FakeClockScheduler implements Clock, Scheduler {
  private readonly origin = Temporal.Instant.from("2026-09-16T00:00:00Z");
  private current = this.origin;
  private readonly tasks: Task[] = [];

  now(): Temporal.Instant {
    return this.current;
  }

  scheduleAt(at: Temporal.Instant, task: ScheduledTask): ScheduledHandle {
    const scheduled = { at, active: true, task };
    this.tasks.push(scheduled);
    return { cancel: () => (scheduled.active = false) };
  }

  async advanceTo(seconds: number): Promise<void> {
    const target = this.origin.add({ seconds });
    while (true) {
      const next = this.tasks
        .filter((task) => task.active && Temporal.Instant.compare(task.at, target) <= 0)
        .sort((left, right) => Temporal.Instant.compare(left.at, right.at))[0];
      if (!next) break;
      next.active = false;
      this.current = next.at;
      await next.task();
      await this.flush();
    }
    this.current = target;
    await this.flush();
  }

  private async flush(): Promise<void> {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  }
}

class MemorySnapshotRepository implements CollectionSnapshotRepository {
  readonly saved: CollectionResultRecord[] = [];

  async save(result: CollectionResultRecord): Promise<void> {
    this.saved.push(result);
  }

  async getLatest(): Promise<StoredCollectionResult | null> {
    return null;
  }

  async getLastHealthy(): Promise<StoredCollectionResult | null> {
    return null;
  }
}

class FakeProvider implements MarketDataProvider {
  readonly starts: number[] = [];
  quoteCalls = 0;
  quoteHandler: (
    instruments: readonly InstrumentId[],
    signal?: AbortSignal,
  ) => Promise<QuoteSnapshot[]>;

  constructor(
    private readonly clock: Clock,
    handler?: FakeProvider["quoteHandler"],
  ) {
    this.quoteHandler =
      handler ??
      ((instruments) => Promise.resolve(instruments.map((value) => quote(value, clock))));
  }

  async getIndices(
    instruments: readonly InstrumentId[],
    signal?: AbortSignal,
  ): Promise<QuoteSnapshot[]> {
    return this.getQuotes(instruments, signal);
  }

  async getQuotes(
    instruments: readonly InstrumentId[],
    signal?: AbortSignal,
  ): Promise<QuoteSnapshot[]> {
    this.quoteCalls += 1;
    this.starts.push(this.clock.now().epochMilliseconds);
    return this.quoteHandler(instruments, signal);
  }

  async search(): Promise<InstrumentSearchResult[]> {
    return [];
  }

  async getInstrumentDetails(): Promise<InstrumentDetails> {
    throw new Error("Not used by collection tests.");
  }

  async getOhlcv(): Promise<Ohlcv[]> {
    return [];
  }

  async getExchangeRates(): Promise<ExchangeRateObservation[]> {
    return [];
  }
}

const quote = (instrument: InstrumentId, clock: Clock): QuoteSnapshot => ({
  instrument,
  name: instrument.symbol,
  kind: "equity",
  currency: "USD",
  price: createAmount("price", "100"),
  previousClose: createAmount("price", "99"),
  changePercent: createAmount("ratio", "1.01"),
  marketStatus: "open",
  marketTimestamp: clock.now(),
  collectedAt: clock.now(),
  source: "fixture",
});

const logger: CollectionEngineLogger = { info: () => undefined, warn: () => undefined };
const ids: readonly CollectionGroup[] = ["indices", "popular", "watchlist", "portfolio"];

const definitions = (
  instruments: Partial<Record<CollectionGroup, readonly InstrumentId[]>>,
  statuses: Partial<Record<CollectionGroup, MarketStatus>> = {},
): CollectionGroupDefinition[] =>
  ids.map((id) => ({
    id,
    getInstruments: () => instruments[id] ?? [],
    getMarketStatus: () => statuses[id] ?? "open",
  }));

const createEngine = (
  clock: FakeClockScheduler,
  provider: MarketDataProvider,
  repository: CollectionSnapshotRepository,
  groups: CollectionGroupDefinition[],
  batchSize = 10,
) =>
  new FixedTimeCollectionEngine(groups, provider, repository, clock, clock, logger, {
    intervalSeconds: 2,
    timeoutSeconds: 5,
    batchSize,
    retryCount: 3,
  });

describe("FixedTimeCollectionEngine", () => {
  it("runs four independent groups on fixed two-second ticks and skips empty groups", async () => {
    const clock = new FakeClockScheduler();
    const provider = new FakeProvider(clock);
    const repository = new MemorySnapshotRepository();
    const apple = createInstrumentId("AAPL", "XNAS");
    const engine = createEngine(
      clock,
      provider,
      repository,
      definitions({ indices: [apple], popular: [apple] }),
    );

    engine.start();
    await clock.advanceTo(4);

    expect(engine.state("indices").metrics.successes).toBe(3);
    expect(engine.state("popular").metrics.successes).toBe(3);
    expect(engine.state("watchlist").status).toBe("empty");
    expect(engine.state("portfolio").status).toBe("empty");
    expect(provider.quoteCalls).toBe(6);
  });

  it("starts timed-out attempts at 0, 6, 12, and 18 seconds and stops at 23 seconds", async () => {
    const clock = new FakeClockScheduler();
    const provider = new FakeProvider(clock, (_instruments, signal) => {
      if (!signal) throw new Error("Expected an AbortSignal.");
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
    const repository = new MemorySnapshotRepository();
    const engine = createEngine(
      clock,
      provider,
      repository,
      definitions({ indices: [createInstrumentId("KOSPI", "XKRX")] }),
    );
    const originMs = clock.now().epochMilliseconds;

    engine.start();
    await clock.advanceTo(23);

    expect(provider.starts.map((value) => (value - originMs) / 1_000)).toEqual([0, 6, 12, 18]);
    expect(engine.state("indices")).toMatchObject({
      status: "failed",
      stopped: true,
      consecutiveFailures: 4,
      metrics: { attempts: 4, failures: 4, skipped: 8 },
    });
  });

  it("does not let one timed-out group block healthy groups", async () => {
    const clock = new FakeClockScheduler();
    const provider = new FakeProvider(clock, (instruments, signal) => {
      if (instruments[0]?.symbol !== "KOSPI") {
        return Promise.resolve(instruments.map((value) => quote(value, clock)));
      }
      if (!signal) throw new Error("Expected an AbortSignal.");
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
    const engine = createEngine(
      clock,
      provider,
      new MemorySnapshotRepository(),
      definitions({
        indices: [createInstrumentId("KOSPI", "XKRX")],
        popular: [createInstrumentId("AAPL", "XNAS")],
      }),
    );

    engine.start();
    await clock.advanceTo(6);

    expect(engine.state("indices").metrics.failures).toBe(1);
    expect(engine.state("popular").metrics.successes).toBe(4);
  });

  it("keeps the last healthy values visible after a full failure without writing them as a new result", async () => {
    const clock = new FakeClockScheduler();
    const provider = new FakeProvider(clock);
    const repository = new MemorySnapshotRepository();
    const engine = createEngine(
      clock,
      provider,
      repository,
      definitions({ indices: [createInstrumentId("KOSPI", "XKRX")] }),
    );

    engine.start();
    await clock.advanceTo(0);
    provider.quoteHandler = () => Promise.reject(new Error("provider unavailable"));
    await clock.advanceTo(2);

    expect(engine.state("indices").values).toHaveLength(1);
    expect(engine.state("indices").status).toBe("failed");
    expect(engine.state("indices").lastHealthyAt?.toString()).toBe("2026-09-16T00:00:00Z");
    expect(repository.saved.filter(({ group }) => group === "indices").at(-1)).toMatchObject({
      status: "failed",
      payload: { values: [] },
      validationSucceeded: false,
    });
  });

  it("keeps successful batches on partial failure and resets failures after recovery", async () => {
    const clock = new FakeClockScheduler();
    const provider = new FakeProvider(clock);
    let failMicrosoft = true;
    provider.quoteHandler = (instruments) => {
      if (failMicrosoft && instruments[0]?.symbol === "MSFT")
        return Promise.reject(new Error("fail"));
      return Promise.resolve(instruments.map((value) => quote(value, clock)));
    };
    const engine = createEngine(
      clock,
      provider,
      new MemorySnapshotRepository(),
      definitions({
        watchlist: [createInstrumentId("AAPL", "XNAS"), createInstrumentId("MSFT", "XNAS")],
      }),
      1,
    );

    engine.start();
    await clock.advanceTo(0);
    expect(engine.state("watchlist")).toMatchObject({
      status: "partial",
      consecutiveFailures: 1,
    });
    expect(engine.state("watchlist").values.map(({ instrument }) => instrument.symbol)).toEqual([
      "AAPL",
    ]);

    failMicrosoft = false;
    await clock.advanceTo(2);
    expect(engine.state("watchlist")).toMatchObject({
      status: "healthy",
      consecutiveFailures: 0,
    });
  });

  it("keeps manual-query failures outside automatic counters and retries only one group", async () => {
    const clock = new FakeClockScheduler();
    const provider = new FakeProvider(clock);
    const engine = createEngine(
      clock,
      provider,
      new MemorySnapshotRepository(),
      definitions({
        indices: [createInstrumentId("KOSPI", "XKRX")],
        popular: [createInstrumentId("AAPL", "XNAS")],
      }),
    );
    engine.start();
    await clock.advanceTo(0);
    const before = engine.state("indices").metrics;
    const popularBeforeRetry = engine.state("popular");
    provider.quoteHandler = () => Promise.reject(new Error("manual failure"));

    await expect(engine.runManualQuery([createInstrumentId("MSFT", "XNAS")])).rejects.toThrow();
    expect(engine.state("indices").metrics).toEqual(before);

    engine.retryGroup("indices");
    expect(engine.state("indices").status).toBe("loading");
    expect(engine.state("popular")).toEqual(popularBeforeRetry);
    expect(engine.state("indices").nextDueAt?.toString()).toBe("2026-09-16T00:00:02Z");
  });

  it("resets every stopped group only when an explicit full reset is requested", async () => {
    const clock = new FakeClockScheduler();
    const provider = new FakeProvider(clock, (_instruments, signal) => {
      if (!signal) throw new Error("Expected an AbortSignal.");
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
    const engine = createEngine(
      clock,
      provider,
      new MemorySnapshotRepository(),
      definitions({ indices: [createInstrumentId("KOSPI", "XKRX")] }),
    );
    engine.start();
    await clock.advanceTo(23);
    expect(engine.state("indices").stopped).toBe(true);

    provider.quoteHandler = (instruments) =>
      Promise.resolve(instruments.map((value) => quote(value, clock)));
    engine.resetAll();
    expect(engine.state("indices")).toMatchObject({ stopped: false, consecutiveFailures: 0 });
    await clock.advanceTo(25);
    expect(engine.state("indices")).toMatchObject({ status: "healthy", stopped: false });
  });

  it("rebases T0 when a closed market reopens without resetting failure state", async () => {
    const clock = new FakeClockScheduler();
    const statuses: Partial<Record<CollectionGroup, MarketStatus>> = { indices: "open" };
    const provider = new FakeProvider(clock, () => Promise.reject(new Error("initial failure")));
    const engine = createEngine(
      clock,
      provider,
      new MemorySnapshotRepository(),
      definitions({ indices: [createInstrumentId("KOSPI", "XKRX")] }, statuses),
    );
    engine.start();
    await clock.advanceTo(0);
    expect(engine.state("indices").consecutiveFailures).toBe(1);
    statuses.indices = "closed";
    await clock.advanceTo(4);
    expect(engine.state("indices").status).toBe("paused");
    expect(provider.quoteCalls).toBe(1);

    provider.quoteHandler = (_instruments, signal) => {
      if (!signal) throw new Error("Expected an AbortSignal.");
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    };
    statuses.indices = "open";
    await clock.advanceTo(6);

    expect(engine.state("indices").t0.toString()).toBe("2026-09-16T00:00:06Z");
    expect(engine.state("indices").nextDueAt?.toString()).toBe("2026-09-16T00:00:08Z");
    expect(engine.state("indices")).toMatchObject({ inFlight: true, consecutiveFailures: 1 });
  });
});
