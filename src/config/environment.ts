import "server-only";

export type RawEnvironment = Readonly<{
  databaseUrl: string | undefined;
  realtimePollIntervalSeconds: string | undefined;
  providerRequestTimeoutSeconds: string | undefined;
  watchlistMaxSymbols: string | undefined;
  portfolioMaxSymbols: string | undefined;
  providerMaxSymbolsPerRequest: string | undefined;
  providerBatchSize: string | undefined;
}>;

export const readRawEnvironment = (source: NodeJS.ProcessEnv = process.env): RawEnvironment => ({
  databaseUrl: source.DATABASE_URL,
  realtimePollIntervalSeconds: source.REALTIME_POLL_INTERVAL_SECONDS,
  providerRequestTimeoutSeconds: source.PROVIDER_REQUEST_TIMEOUT_SECONDS,
  watchlistMaxSymbols: source.LIMITS_WATCHLIST_MAX_SYMBOLS,
  portfolioMaxSymbols: source.LIMITS_PORTFOLIO_MAX_SYMBOLS,
  providerMaxSymbolsPerRequest: source.PROVIDER_MAX_SYMBOLS_PER_REQUEST,
  providerBatchSize: source.PROVIDER_BATCH_SIZE,
});
