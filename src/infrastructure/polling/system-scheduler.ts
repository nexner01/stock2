import "server-only";

import { Temporal } from "@js-temporal/polyfill";

import type { Clock, ScheduledHandle, ScheduledTask, Scheduler } from "@/ports";

export class SystemClock implements Clock {
  now(): Temporal.Instant {
    return Temporal.Now.instant();
  }
}

export class SystemScheduler implements Scheduler {
  constructor(private readonly clock: Clock) {}

  scheduleAt(at: Temporal.Instant, task: ScheduledTask): ScheduledHandle {
    const delay = Math.max(0, at.epochMilliseconds - this.clock.now().epochMilliseconds);
    const timer = setTimeout(() => {
      void task();
    }, delay);
    return Object.freeze({ cancel: () => clearTimeout(timer) });
  }
}
