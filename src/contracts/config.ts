import { z } from "zod";

import type { AppliedConfig } from "@/config/types";

export const appliedConfigDtoSchema = z
  .object({
    realtime: z.object({ poll_interval_seconds: z.int().min(2) }).readonly(),
    provider: z
      .object({
        request_timeout_seconds: z.int().min(1),
        max_symbols_per_request: z.int().min(1),
        batch_size: z.int().min(1),
      })
      .readonly(),
    limits: z
      .object({
        watchlist_max_symbols: z.int().min(1),
        portfolio_max_symbols: z.int().min(1),
      })
      .readonly(),
  })
  .readonly()
  .superRefine((value, context) => {
    if (value.provider.batch_size > value.provider.max_symbols_per_request) {
      context.addIssue({
        code: "custom",
        path: ["provider", "batch_size"],
        message: "batch_size는 max_symbols_per_request 이하여야 합니다.",
      });
    }
  });

export type AppliedConfigDto = z.infer<typeof appliedConfigDtoSchema>;

export const toAppliedConfigDto = (config: AppliedConfig): AppliedConfigDto =>
  appliedConfigDtoSchema.parse(config);
