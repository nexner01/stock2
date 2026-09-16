export type RawEnvironment = Readonly<{
  databaseUrl: string | undefined;
  realtimePollIntervalSeconds: string | undefined;
  providerRequestTimeoutSeconds: string | undefined;
  watchlistMaxSymbols: string | undefined;
  portfolioMaxSymbols: string | undefined;
  providerMaxSymbolsPerRequest: string | undefined;
  providerBatchSize: string | undefined;
}>;

export type AppliedConfig = Readonly<{
  realtime: Readonly<{ poll_interval_seconds: number }>;
  provider: Readonly<{
    request_timeout_seconds: number;
    max_symbols_per_request: number;
    batch_size: number;
  }>;
  limits: Readonly<{
    watchlist_max_symbols: number;
    portfolio_max_symbols: number;
  }>;
}>;

export type ConfigCorrectionReason =
  "missing" | "not_a_number" | "not_an_integer" | "below_minimum" | "exceeds_request_limit";

export type ConfigCorrection = Readonly<{
  key: string;
  inputValue: string | null;
  appliedValue: number;
  reason: ConfigCorrectionReason;
}>;

export interface ConfigCorrectionLogger {
  warn(correction: ConfigCorrection, message: string): void;
}
