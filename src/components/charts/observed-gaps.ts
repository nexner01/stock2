import { Temporal } from "@js-temporal/polyfill";

import type { Interval } from "@/domain";

export type ObservedGap = Readonly<{ after: string; before: string }>;

const intervalMilliseconds: Readonly<Record<Interval, number>> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "1d": 86_400_000,
};

export function findObservedGaps(
  timestamps: readonly string[],
  interval: Interval,
): readonly ObservedGap[] {
  const expected = intervalMilliseconds[interval];
  const gaps: ObservedGap[] = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    const previous = timestamps[index - 1];
    const current = timestamps[index];
    if (!previous || !current) continue;
    const previousInstant = Temporal.Instant.from(previous);
    const currentInstant = Temporal.Instant.from(current);
    if (currentInstant.epochMilliseconds - previousInstant.epochMilliseconds > expected * 1.5) {
      gaps.push({ after: previous, before: current });
    }
  }
  return gaps;
}
