import type { InstrumentId, Interval, Ohlcv } from "@/domain";

export type OhlcvRangeQuery = Readonly<{
  instrument: InstrumentId;
  interval: Interval;
  start: string;
  end: string;
  source: string;
}>;

export interface OhlcvRepository {
  saveMany(values: readonly Ohlcv[]): Promise<void>;
  findRange(query: OhlcvRangeQuery): Promise<Ohlcv[]>;
}
