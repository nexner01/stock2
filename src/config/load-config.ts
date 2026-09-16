import "server-only";

import { applyConfig } from "./apply-config";
import { readRawEnvironment } from "./environment";
import type { AppliedConfig, ConfigCorrectionLogger } from "./types";

export const loadAppliedConfig = (
  logger: ConfigCorrectionLogger,
  source: NodeJS.ProcessEnv = process.env,
): AppliedConfig => applyConfig(readRawEnvironment(source), logger);
