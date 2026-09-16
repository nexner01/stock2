import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import YahooFinance from "yahoo-finance2";

type ProbeResult = {
  name: string;
  ok: boolean;
  expectedFailure?: boolean;
  durationMs: number;
  details?: Record<string, unknown>;
  error?: string;
};

type GroupMetric = {
  attempts: number;
  successes: number;
  failures: number;
  delayed: number;
  skipped: number;
  http429: number;
  durationsMs: number[];
};

type SmokeGroup = {
  name: string;
  symbols: string[];
};

type QuoteSummary = {
  symbol: string;
  fullExchangeName?: string;
  exchange?: string;
  currency?: string;
  quoteType?: string;
};

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const args = new Set(process.argv.slice(2));

const readOption = (name: string, fallback: string): string => {
  const index = process.argv.indexOf(name);
  const value = process.argv[index + 1];
  return index >= 0 && value ? value : fallback;
};

const isQuoteSummary = (value: unknown): value is QuoteSummary =>
  typeof value === "object" &&
  value !== null &&
  "symbol" in value &&
  typeof value.symbol === "string";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const round = (value: number): number => Math.round(value * 100) / 100;

const percentile = (values: number[], ratio: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * ratio) - 1] ?? 0;
};

const daysAgo = (days: number): Date => new Date(Date.now() - days * 86_400_000);

const measure = async (
  name: string,
  operation: () => Promise<Record<string, unknown>>,
  expectedFailure = false,
): Promise<ProbeResult> => {
  const startedAt = performance.now();
  try {
    const details = await operation();
    return { name, ok: true, durationMs: round(performance.now() - startedAt), details };
  } catch (error) {
    return {
      name,
      ok: false,
      expectedFailure,
      durationMs: round(performance.now() - startedAt),
      error: toErrorMessage(error),
    };
  }
};

const runProbe = async (): Promise<Record<string, unknown>> => {
  const symbolGroups = {
    indices: ["^KS11", "^KQ11", "^IXIC", "^GSPC"],
    recommendations: ["VTI", "BND", "MTUM", "TLT", "IEF", "DBC", "GLD", "IJS", "SHY"],
    fx: ["KRW=X"],
  } as const;

  const probeResults: ProbeResult[] = [];
  for (const [group, symbols] of Object.entries(symbolGroups)) {
    probeResults.push(
      await measure(`symbols:${group}`, async () => {
        const quotes = await yahooFinance.quote([...symbols]);
        const normalized = (Array.isArray(quotes) ? quotes : Object.values(quotes)).filter(
          isQuoteSummary,
        );
        return {
          requested: symbols.length,
          returned: normalized.length,
          symbols: normalized.map((quote) => ({
            symbol: quote.symbol,
            exchange: quote.fullExchangeName ?? quote.exchange,
            currency: quote.currency,
            quoteType: quote.quoteType,
          })),
        };
      }),
    );
  }

  const capabilityCases = [
    { label: "1h", days: 1, interval: "1m" as const },
    { label: "1d", days: 5, interval: "1m" as const },
    { label: "1w", days: 7, interval: "5m" as const },
    { label: "1mo", days: 30, interval: "15m" as const },
    { label: "6mo", days: 183, interval: "1h" as const },
    { label: "1y", days: 366, interval: "1h" as const },
    { label: "10y", days: 3_653, interval: "1d" as const },
  ];

  for (const symbol of ["AAPL", "005930.KS"] as const) {
    for (const capability of capabilityCases) {
      probeResults.push(
        await measure(`chart:${symbol}:${capability.label}:${capability.interval}`, async () => {
          const chart = await yahooFinance.chart(symbol, {
            period1: daysAgo(capability.days),
            period2: new Date(),
            interval: capability.interval,
            events: "div|split",
          });
          const quotes = chart.quotes.filter((quote) => quote.close !== null);
          return {
            count: quotes.length,
            currency: chart.meta.currency,
            exchange: chart.meta.exchangeName,
            timezone: chart.meta.exchangeTimezoneName,
            first: quotes.at(0)?.date.toISOString(),
            last: quotes.at(-1)?.date.toISOString(),
            adjustedCloseCount: quotes.filter((quote) => quote.adjclose !== null).length,
          };
        }),
      );
    }
  }

  for (const query of ["삼성전자", "Samsung Electronics", "005930", "AAPL"] as const) {
    probeResults.push(
      await measure(
        `search:${query}`,
        async () => {
          const result = await yahooFinance.search(query, { newsCount: 0, quotesCount: 10 });
          return {
            returned: result.quotes.length,
            quotes: result.quotes.slice(0, 5).map((quote) => ({
              symbol: quote.symbol,
              exchange: quote.exchange,
              name: quote.shortname ?? quote.longname,
              quoteType: quote.quoteType,
            })),
          };
        },
        query === "삼성전자",
      ),
    );
  }

  const batchSymbols = [
    "^KS11",
    "^KQ11",
    "^IXIC",
    "^GSPC",
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
    "VTI",
    "BND",
    "MTUM",
    "TLT",
    "IEF",
    "DBC",
    "GLD",
    "IJS",
    "SHY",
    "005930.KS",
  ];

  for (const size of [4, 10, 20] as const) {
    probeResults.push(
      await measure(`quote-batch:${size}`, async () => {
        const requested = batchSymbols.slice(0, size);
        const quotes = await yahooFinance.quote(requested);
        const normalized = Array.isArray(quotes) ? quotes : Object.values(quotes);
        return { requested: requested.length, returned: normalized.length };
      }),
    );
  }

  return {
    kind: "provider-probe",
    provider: "Yahoo Finance via yahoo-finance2 4.0.2",
    executedAt: new Date().toISOString(),
    environment: { node: process.version, platform: process.platform },
    summary: {
      total: probeResults.length,
      passed: probeResults.filter((result) => result.ok).length,
      expectedUnsupported: probeResults.filter((result) => !result.ok && result.expectedFailure)
        .length,
      unexpectedFailures: probeResults.filter((result) => !result.ok && !result.expectedFailure)
        .length,
    },
    results: probeResults,
  };
};

const wait = async (milliseconds: number): Promise<void> =>
  new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const runSmoke = async (durationSeconds: number): Promise<Record<string, unknown>> => {
  const intervalMs = 2_000;
  const timeoutMs = 5_000;
  const groups: SmokeGroup[] = [
    { name: "indices", symbols: ["^KS11", "^KQ11", "^IXIC", "^GSPC"] },
    { name: "popular", symbols: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"] },
    {
      name: "watchlist",
      symbols: ["VTI", "BND", "MTUM", "TLT", "IEF", "DBC", "GLD", "IJS", "SHY", "META"],
    },
    {
      name: "portfolio",
      symbols: ["AAPL", "MSFT", "NVDA", "VTI", "BND", "TLT", "DBC", "GLD", "005930.KS", "KRW=X"],
    },
  ];
  const warmupStartedAt = performance.now();
  await withTimeout(yahooFinance.quote(["^KS11"]), timeoutMs);
  const warmupDurationMs = round(performance.now() - warmupStartedAt);
  const ticks = Math.ceil((durationSeconds * 1_000) / intervalMs);
  const metrics = new Map<string, GroupMetric>();
  const inFlight = new Map<string, Promise<void>>();
  for (const group of groups) {
    metrics.set(group.name, {
      attempts: 0,
      successes: 0,
      failures: 0,
      delayed: 0,
      skipped: 0,
      http429: 0,
      durationsMs: [],
    });
  }

  const startedAt = Date.now();
  for (let tick = 0; tick < ticks; tick += 1) {
    const dueAt = startedAt + tick * intervalMs;
    await wait(Math.max(0, dueAt - Date.now()));

    for (const group of groups) {
      const metric = metrics.get(group.name);
      if (!metric) throw new Error(`missing metric for ${group.name}`);
      if (inFlight.has(group.name)) {
        metric.skipped += 1;
        continue;
      }

      metric.attempts += 1;
      const requestStartedAt = performance.now();
      const request = (async () => {
        try {
          await withTimeout(yahooFinance.quote(group.symbols), timeoutMs);
          metric.successes += 1;
        } catch (error) {
          const message = toErrorMessage(error);
          metric.failures += 1;
          if (message.includes("timeout after")) metric.delayed += 1;
          if (message.includes("429")) metric.http429 += 1;
        } finally {
          metric.durationsMs.push(round(performance.now() - requestStartedAt));
          inFlight.delete(group.name);
        }
      })();
      inFlight.set(group.name, request);
    }
  }

  await Promise.all(inFlight.values());
  const groupResults = Object.fromEntries(
    [...metrics.entries()].map(([name, metric]) => [
      name,
      {
        attempts: metric.attempts,
        successes: metric.successes,
        failures: metric.failures,
        delayed: metric.delayed,
        skipped: metric.skipped,
        http429: metric.http429,
        averageMs: round(
          metric.durationsMs.reduce((total, duration) => total + duration, 0) /
            Math.max(metric.durationsMs.length, 1),
        ),
        p95Ms: percentile(metric.durationsMs, 0.95),
      },
    ]),
  );
  const passed = [...metrics.values()].every(
    (metric) => metric.delayed === 0 && metric.skipped === 0 && metric.failures === 0,
  );

  return {
    kind: "provider-smoke",
    provider: "Yahoo Finance via yahoo-finance2 4.0.2",
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    configuration: {
      durationSeconds,
      intervalMs,
      timeoutMs,
      fixedTick: true,
      providerSessionWarmup: true,
      warmupDurationMs,
    },
    passCriteria:
      "all groups have zero failures, delayed requests, skipped ticks, and HTTP 429 responses",
    passed,
    groups: groupResults,
  };
};

const main = async (): Promise<void> => {
  const shouldProbe = args.has("--probe");
  const shouldSmoke = args.has("--smoke");
  if (!shouldProbe && !shouldSmoke) {
    throw new Error("Use --probe or --smoke.");
  }

  const outputPath = resolve(
    readOption(
      "--output",
      shouldProbe ? "docs/validation/provider-probe.json" : "docs/validation/provider-smoke.json",
    ),
  );
  const durationSeconds = Number.parseInt(readOption("--duration-seconds", "60"), 10);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 2) {
    throw new Error("--duration-seconds must be an integer of at least 2.");
  }

  const result = shouldProbe ? await runProbe() : await runSmoke(durationSeconds);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if ("passed" in result && result.passed === false) process.exitCode = 1;
  if (shouldProbe) {
    const summary = result.summary;
    if (
      typeof summary === "object" &&
      summary !== null &&
      "unexpectedFailures" in summary &&
      typeof summary.unexpectedFailures === "number" &&
      summary.unexpectedFailures > 0
    ) {
      process.exitCode = 1;
    }
  }
};

await main();
