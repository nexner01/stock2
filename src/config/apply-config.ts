import { z } from "zod";

import type {
  AppliedConfig,
  ConfigCorrection,
  ConfigCorrectionLogger,
  ConfigCorrectionReason,
  RawEnvironment,
} from "./types";

type IntegerPolicy = Readonly<{
  key: string;
  input: string | undefined;
  defaultValue: number;
  minimum: number;
}>;

const numericTextSchema = z.string().trim().min(1);

const applyInteger = (policy: IntegerPolicy, logger: ConfigCorrectionLogger): number => {
  const parsedText = numericTextSchema.safeParse(policy.input);
  let appliedValue = policy.defaultValue;
  let reason: ConfigCorrectionReason | null = null;

  if (!parsedText.success) {
    reason = "missing";
  } else {
    const numeric = Number(parsedText.data);
    if (Number.isNaN(numeric) || !Number.isFinite(numeric)) reason = "not_a_number";
    else if (!Number.isInteger(numeric)) reason = "not_an_integer";
    else if (numeric < policy.minimum) {
      reason = "below_minimum";
      appliedValue = policy.defaultValue;
    } else appliedValue = numeric;
  }

  if (reason) {
    const correction: ConfigCorrection = Object.freeze({
      key: policy.key,
      inputValue: policy.input ?? null,
      appliedValue,
      reason,
    });
    logger.warn(correction, "환경 설정값을 보정했습니다.");
  }
  return appliedValue;
};

export const applyPollIntervalSetting = (
  key:
    | "realtime.poll_interval_seconds"
    | "server.poll_interval_seconds"
    | "client.refresh_interval_seconds",
  input: string | undefined,
  logger: ConfigCorrectionLogger,
): number =>
  applyInteger(
    {
      key,
      input,
      defaultValue: 2,
      minimum: 2,
    },
    logger,
  );

export const applyConfig = (raw: RawEnvironment, logger: ConfigCorrectionLogger): AppliedConfig => {
  const pollInterval = applyPollIntervalSetting(
    "realtime.poll_interval_seconds",
    raw.realtimePollIntervalSeconds,
    logger,
  );
  const requestTimeout = applyInteger(
    {
      key: "provider.request_timeout_seconds",
      input: raw.providerRequestTimeoutSeconds,
      defaultValue: 5,
      minimum: 1,
    },
    logger,
  );
  const watchlistLimit = applyInteger(
    {
      key: "limits.watchlist_max_symbols",
      input: raw.watchlistMaxSymbols,
      defaultValue: 20,
      minimum: 1,
    },
    logger,
  );
  const portfolioLimit = applyInteger(
    {
      key: "limits.portfolio_max_symbols",
      input: raw.portfolioMaxSymbols,
      defaultValue: 10,
      minimum: 1,
    },
    logger,
  );
  const requestLimit = applyInteger(
    {
      key: "provider.max_symbols_per_request",
      input: raw.providerMaxSymbolsPerRequest,
      defaultValue: 10,
      minimum: 1,
    },
    logger,
  );
  let batchSize = applyInteger(
    {
      key: "provider.batch_size",
      input: raw.providerBatchSize,
      defaultValue: 10,
      minimum: 1,
    },
    logger,
  );
  if (batchSize > requestLimit) {
    batchSize = requestLimit;
    logger.warn(
      Object.freeze({
        key: "provider.batch_size",
        inputValue: raw.providerBatchSize ?? null,
        appliedValue: batchSize,
        reason: "exceeds_request_limit",
      }),
      "환경 설정값을 보정했습니다.",
    );
  }

  return Object.freeze({
    realtime: Object.freeze({ poll_interval_seconds: pollInterval }),
    provider: Object.freeze({
      request_timeout_seconds: requestTimeout,
      max_symbols_per_request: requestLimit,
      batch_size: batchSize,
    }),
    limits: Object.freeze({
      watchlist_max_symbols: watchlistLimit,
      portfolio_max_symbols: portfolioLimit,
    }),
  });
};
