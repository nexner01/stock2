import type { Temporal } from "@js-temporal/polyfill";

export interface Clock {
  now(): Temporal.Instant;
}

export type ScheduledTask = () => void | Promise<void>;

export interface ScheduledHandle {
  cancel(): void;
}

export interface Scheduler {
  scheduleAt(at: Temporal.Instant, task: ScheduledTask): ScheduledHandle;
}
