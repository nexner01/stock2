import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";

import { createInstrumentId } from "../instruments";
import { planAnalysisStart, type AnalysisAssetRange } from "./analysis-start";

const asset = (
  symbol: string,
  firstAvailableDate: string,
  lastAvailableDate = "2026-01-01",
): AnalysisAssetRange => ({
  instrument: createInstrumentId(symbol, "NMS"),
  firstAvailableDate: Temporal.PlainDate.from(firstAvailableDate),
  lastAvailableDate: Temporal.PlainDate.from(lastAvailableDate),
});

describe("AC-03, AC-04, and AC-05 common analysis start policy", () => {
  const requestedStart = Temporal.PlainDate.from("2020-01-01");
  const established = asset("AAPL", "2010-01-01");
  const recent = asset("NEW", "2022-05-10");

  it("keeps every asset and starts at the latest first-available date without creating zero values", () => {
    const plan = planAnalysisStart(requestedStart, [established, recent], "common-period");

    expect(plan.actualStart?.toString()).toBe("2022-05-10");
    expect(plan.affected.map(({ instrument }) => instrument.symbol)).toEqual(["NEW"]);
    expect(plan.excluded).toEqual([]);
  });

  it("excludes short-history assets for this execution without mutating the saved input", () => {
    const saved = [established, recent] as const;
    const before = JSON.stringify(saved);
    const plan = planAnalysisStart(requestedStart, saved, "exclude-short-history");

    expect(plan.actualStart?.toString()).toBe("2020-01-01");
    expect(plan.included.map(({ instrument }) => instrument.symbol)).toEqual(["AAPL"]);
    expect(plan.excluded.map(({ asset: excluded }) => excluded.instrument.symbol)).toEqual(["NEW"]);
    expect(JSON.stringify(saved)).toBe(before);
  });

  it("returns a cancelled plan without selecting an analysis start", () => {
    const plan = planAnalysisStart(requestedStart, [established, recent], "cancel");

    expect(plan.cancelled).toBe(true);
    expect(plan.actualStart).toBeNull();
  });
});
