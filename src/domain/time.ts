import { Temporal } from "@js-temporal/polyfill";

export const parseUtcInstant = (value: string): Temporal.Instant => {
  const instant = Temporal.Instant.from(value);
  if (!value.endsWith("Z")) throw new Error(`UTC instant must end in Z: ${value}`);
  return instant;
};

export const parsePlainDate = (value: string): Temporal.PlainDate => Temporal.PlainDate.from(value);

export const compareDates = (left: Temporal.PlainDate, right: Temporal.PlainDate): number =>
  Temporal.PlainDate.compare(left, right);
