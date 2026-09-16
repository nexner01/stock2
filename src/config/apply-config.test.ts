import { describe, expect, it } from "vitest";

import { appliedConfigDtoSchema, toAppliedConfigDto } from "@/contracts/config";

import { applyConfig, applyPollIntervalSetting } from "./apply-config";
import type { ConfigCorrection, ConfigCorrectionLogger, RawEnvironment } from "./types";

const validRaw: RawEnvironment = {
  databaseUrl: "./data/test.db",
  realtimePollIntervalSeconds: "5",
  providerRequestTimeoutSeconds: "7",
  watchlistMaxSymbols: "30",
  portfolioMaxSymbols: "15",
  providerMaxSymbolsPerRequest: "12",
  providerBatchSize: "8",
};

const createLogger = (): { logger: ConfigCorrectionLogger; corrections: ConfigCorrection[] } => {
  const corrections: ConfigCorrection[] = [];
  return {
    corrections,
    logger: { warn: (correction) => corrections.push(correction) },
  };
};

const positiveIntegerSettings = [
  ["providerRequestTimeoutSeconds", "provider.request_timeout_seconds", 5],
  ["watchlistMaxSymbols", "limits.watchlist_max_symbols", 20],
  ["portfolioMaxSymbols", "limits.portfolio_max_symbols", 10],
  ["providerMaxSymbolsPerRequest", "provider.max_symbols_per_request", 10],
  ["providerBatchSize", "provider.batch_size", 10],
] as const;

const invalidPositiveIntegers = [
  [undefined, "missing"],
  ["abc", "not_a_number"],
  ["2.5", "not_an_integer"],
  ["0", "below_minimum"],
  ["-3", "below_minimum"],
] as const;

const invalidSettingCases = positiveIntegerSettings.flatMap(([rawKey, configKey, defaultValue]) =>
  invalidPositiveIntegers.map(
    ([input, reason]) => [rawKey, configKey, defaultValue, input, reason] as const,
  ),
);

describe("AC-13 and AC-26 applied configuration", () => {
  it("applies valid positive integers without corrections and exposes a client contract", () => {
    const { logger, corrections } = createLogger();
    const config = applyConfig(validRaw, logger);

    expect(config).toEqual({
      realtime: { poll_interval_seconds: 5 },
      provider: {
        request_timeout_seconds: 7,
        max_symbols_per_request: 12,
        batch_size: 8,
      },
      limits: { watchlist_max_symbols: 30, portfolio_max_symbols: 15 },
    });
    expect(corrections).toEqual([]);
    expect(appliedConfigDtoSchema.parse(toAppliedConfigDto(config))).toEqual(config);
  });

  it("uses every PDD default when values are missing", () => {
    const { logger, corrections } = createLogger();
    const config = applyConfig(
      {
        databaseUrl: undefined,
        realtimePollIntervalSeconds: undefined,
        providerRequestTimeoutSeconds: undefined,
        watchlistMaxSymbols: undefined,
        portfolioMaxSymbols: undefined,
        providerMaxSymbolsPerRequest: undefined,
        providerBatchSize: undefined,
      },
      logger,
    );

    expect(config).toEqual({
      realtime: { poll_interval_seconds: 2 },
      provider: {
        request_timeout_seconds: 5,
        max_symbols_per_request: 10,
        batch_size: 10,
      },
      limits: { watchlist_max_symbols: 20, portfolio_max_symbols: 10 },
    });
    expect(corrections).toHaveLength(6);
    expect(corrections.every(({ reason }) => reason === "missing")).toBe(true);
  });

  it.each([
    ["not numeric", "abc", "not_a_number"],
    ["not integer", "2.5", "not_an_integer"],
    ["zero", "0", "below_minimum"],
    ["negative", "-3", "below_minimum"],
  ] as const)("corrects a poll interval that is %s", (_label, input, reason) => {
    const { logger, corrections } = createLogger();
    const config = applyConfig({ ...validRaw, realtimePollIntervalSeconds: input }, logger);

    expect(config.realtime.poll_interval_seconds).toBe(2);
    expect(corrections).toContainEqual({
      key: "realtime.poll_interval_seconds",
      inputValue: input,
      appliedValue: 2,
      reason,
    });
  });

  it.each(invalidSettingCases)(
    "restores the default for invalid %s input %s",
    (rawKey, configKey, defaultValue, input, reason) => {
      const { logger, corrections } = createLogger();
      applyConfig({ ...validRaw, [rawKey]: input }, logger);

      expect(corrections).toContainEqual({
        key: configKey,
        inputValue: input ?? null,
        appliedValue: defaultValue,
        reason,
      });
    },
  );

  it("clamps batch size to the applied provider request limit", () => {
    const { logger, corrections } = createLogger();
    const config = applyConfig(
      { ...validRaw, providerMaxSymbolsPerRequest: "4", providerBatchSize: "10" },
      logger,
    );

    expect(config.provider.batch_size).toBe(4);
    expect(corrections).toContainEqual({
      key: "provider.batch_size",
      inputValue: "10",
      appliedValue: 4,
      reason: "exceeds_request_limit",
    });
  });

  it.each(["server.poll_interval_seconds", "client.refresh_interval_seconds"] as const)(
    "preserves the AC-18 future boundary for %s",
    (key) => {
      const { logger, corrections } = createLogger();

      expect(applyPollIntervalSetting(key, "invalid", logger)).toBe(2);
      expect(corrections).toContainEqual({
        key,
        inputValue: "invalid",
        appliedValue: 2,
        reason: "not_a_number",
      });
    },
  );
});
