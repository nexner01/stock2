import { Temporal } from "@js-temporal/polyfill";

import type { InstrumentId } from "../instruments";
import { compareDates } from "../time";

export type AnalysisAssetRange = Readonly<{
  instrument: InstrumentId;
  firstAvailableDate: Temporal.PlainDate;
  lastAvailableDate: Temporal.PlainDate;
}>;

export type AnalysisStartStrategy = "common-period" | "exclude-short-history" | "cancel";

export type AnalysisStartPlan = Readonly<{
  strategy: AnalysisStartStrategy;
  requestedStart: Temporal.PlainDate;
  actualStart: Temporal.PlainDate | null;
  included: readonly AnalysisAssetRange[];
  excluded: readonly Readonly<{ asset: AnalysisAssetRange; reason: "short-history" }>[];
  affected: readonly AnalysisAssetRange[];
  cancelled: boolean;
}>;

const latestStart = (
  requestedStart: Temporal.PlainDate,
  assets: readonly AnalysisAssetRange[],
): Temporal.PlainDate =>
  assets.reduce(
    (latest, asset) =>
      compareDates(asset.firstAvailableDate, latest) > 0 ? asset.firstAvailableDate : latest,
    requestedStart,
  );

export const planAnalysisStart = (
  requestedStart: Temporal.PlainDate,
  assets: readonly AnalysisAssetRange[],
  strategy: AnalysisStartStrategy,
): AnalysisStartPlan => {
  if (assets.length === 0) throw new Error("At least one analysis asset is required.");
  for (const asset of assets) {
    if (compareDates(asset.firstAvailableDate, asset.lastAvailableDate) > 0) {
      throw new Error("Asset data range start cannot be after its end.");
    }
  }
  const affected = assets.filter(
    ({ firstAvailableDate }) => compareDates(firstAvailableDate, requestedStart) > 0,
  );
  if (strategy === "cancel") {
    return Object.freeze({
      strategy,
      requestedStart,
      actualStart: null,
      included: Object.freeze([...assets]),
      excluded: Object.freeze([]),
      affected: Object.freeze([...affected]),
      cancelled: true,
    });
  }

  const excludedAssets = strategy === "exclude-short-history" ? affected : [];
  const included = assets.filter((asset) => !excludedAssets.includes(asset));
  if (included.length === 0) {
    throw new Error("Excluding short-history assets would leave no assets to analyze.");
  }
  return Object.freeze({
    strategy,
    requestedStart,
    actualStart: latestStart(requestedStart, included),
    included: Object.freeze([...included]),
    excluded: Object.freeze(
      excludedAssets.map((asset) => Object.freeze({ asset, reason: "short-history" as const })),
    ),
    affected: Object.freeze([...affected]),
    cancelled: false,
  });
};
