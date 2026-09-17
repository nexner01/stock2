import "server-only";

import { Temporal } from "@js-temporal/polyfill";

import { FixedTimeCollectionEngine, type CollectionGroupDefinition } from "@/application";
import { loadAppliedConfig } from "@/config";
import { createInstrumentId, type InstrumentId, type Interval } from "@/domain";
import { appLogger } from "@/infrastructure/logging";
import { SystemClock, SystemScheduler } from "@/infrastructure/polling";
import {
  getDatabase,
  SqliteCollectionSnapshotRepository,
} from "@/infrastructure/persistence/sqlite";
import {
  YahooFinanceApiClient,
  YahooFinanceMarketDataProvider,
} from "@/infrastructure/providers/yahoo-finance";

const config = loadAppliedConfig(appLogger);
const clock = new SystemClock();
const scheduler = new SystemScheduler(clock);
const provider = new YahooFinanceMarketDataProvider(
  new YahooFinanceApiClient(),
  config.provider.request_timeout_seconds,
);

const browserSubscriptions: Record<"watchlist" | "portfolio", readonly InstrumentId[]> = {
  watchlist: [],
  portfolio: [],
};

const groupDefinitions: CollectionGroupDefinition[] = [
  {
    id: "indices",
    getInstruments: () => [
      createInstrumentId("KOSPI", "XKRX"),
      createInstrumentId("KOSDAQ", "XKOS"),
      createInstrumentId("NASDAQ", "XNAS"),
      createInstrumentId("SP500", "XNYS"),
    ],
    getMarketStatus: () => "open",
  },
  {
    id: "popular",
    getInstruments: () =>
      ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"].map((symbol) => createInstrumentId(symbol, "XNAS")),
    getMarketStatus: () => "open",
  },
  {
    id: "watchlist",
    getInstruments: () => browserSubscriptions.watchlist,
    getMarketStatus: () => "open",
  },
  {
    id: "portfolio",
    getInstruments: () => browserSubscriptions.portfolio,
    getMarketStatus: () => "open",
  },
];

let engine: FixedTimeCollectionEngine | undefined;

const getEngine = (): FixedTimeCollectionEngine => {
  engine ??= new FixedTimeCollectionEngine(
    groupDefinitions,
    provider,
    new SqliteCollectionSnapshotRepository(getDatabase()),
    clock,
    scheduler,
    appLogger,
    {
      intervalSeconds: config.realtime.poll_interval_seconds,
      timeoutSeconds: config.provider.request_timeout_seconds,
      batchSize: config.provider.batch_size,
      retryCount: 3,
    },
  );
  return engine;
};

let ready: Promise<void> | null = null;

export const ensureMarketRuntime = (): Promise<void> => {
  ready ??= provider
    .getIndices([createInstrumentId("KOSPI", "XKRX")])
    .then(() => getEngine().start())
    .catch((error: unknown) => {
      ready = null;
      throw error;
    });
  return ready;
};

export const marketRuntime = {
  config,
  get engine() {
    return getEngine();
  },
  provider,
  setBrowserSubscriptions(watchlist: readonly InstrumentId[], portfolio: readonly InstrumentId[]) {
    browserSubscriptions.watchlist = [...watchlist];
    browserSubscriptions.portfolio = [...portfolio];
  },
  now: () => Temporal.Now.instant(),
  periodFor: (period: string): { days: number; interval: Interval } => {
    switch (period) {
      case "1h":
        return { days: 1, interval: "1m" };
      case "1d":
        return { days: 5, interval: "1m" };
      case "5d":
        return { days: 7, interval: "5m" };
      case "1m":
        return { days: 30, interval: "15m" };
      case "6m":
        return { days: 183, interval: "1h" };
      case "1y":
        return { days: 366, interval: "1h" };
      case "3y":
        return { days: 1_096, interval: "1d" };
      case "5y":
        return { days: 1_827, interval: "1d" };
      case "7y":
        return { days: 2_557, interval: "1d" };
      case "10y":
        return { days: 3_653, interval: "1d" };
      default:
        return { days: 1_827, interval: "1d" };
    }
  },
};
