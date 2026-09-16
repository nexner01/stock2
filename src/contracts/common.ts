import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";

export const decimalStringSchema = z.string().refine(
  (value) => {
    try {
      return new Decimal(value).isFinite();
    } catch {
      return false;
    }
  },
  { message: "Decimal 호환 문자열이어야 합니다." },
);

export const utcIsoInstantSchema = z.string().refine(
  (value) => {
    try {
      Temporal.Instant.from(value);
      return value.endsWith("Z");
    } catch {
      return false;
    }
  },
  { message: "UTC ISO 8601 시각이어야 합니다." },
);
