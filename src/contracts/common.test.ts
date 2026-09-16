import { describe, expect, it } from "vitest";

import { decimalStringSchema, utcIsoInstantSchema } from "./common";

describe("public scalar contracts", () => {
  it("accepts finite Decimal strings and rejects JSON numbers", () => {
    expect(decimalStringSchema.parse("1234567890.123456789")).toBe("1234567890.123456789");
    expect(decimalStringSchema.safeParse(0.1).success).toBe(false);
    expect(decimalStringSchema.safeParse("Infinity").success).toBe(false);
  });

  it("accepts UTC ISO 8601 instants and rejects local timestamps", () => {
    expect(utcIsoInstantSchema.parse("2026-09-16T00:00:00Z")).toBe("2026-09-16T00:00:00Z");
    expect(utcIsoInstantSchema.safeParse("2026-09-16T09:00:00+09:00").success).toBe(false);
    expect(utcIsoInstantSchema.safeParse("2026-09-16 00:00:00").success).toBe(false);
  });
});
