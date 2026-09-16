import { z } from "zod";

import type { UserData, UserDataRepository } from "@/ports";

const KEY = "stock2:user-data";
const instrumentSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  exchange: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1),
});
const holdingSchema = instrumentSchema.extend({
  quantity: z.string().regex(/^(?:0*[1-9]\d*(?:\.\d+)?|0*\.\d*[1-9]\d*)$/),
});
const portfolioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  holdings: z.array(holdingSchema),
});
const userDataSchema = z.object({
  version: z.literal(1),
  watchlist: z.array(instrumentSchema),
  portfolios: z.array(portfolioSchema),
  activePortfolioId: z.string().min(1).nullable(),
});
const legacySchema = z.object({
  watchlist: z.array(instrumentSchema).default([]),
  portfolio: z.array(holdingSchema).default([]),
});

export const emptyUserData = (): UserData => ({
  version: 1,
  watchlist: [],
  portfolios: [],
  activePortfolioId: null,
});

export class LocalUserDataRepository implements UserDataRepository {
  constructor(private readonly storage: Storage) {}

  load(): UserData {
    const raw = this.storage.getItem(KEY);
    if (!raw) return emptyUserData();
    try {
      const parsed: unknown = JSON.parse(raw);
      const current = userDataSchema.safeParse(parsed);
      if (current.success) return deduplicate(current.data);
      const legacy = legacySchema.safeParse(parsed);
      if (legacy.success) {
        const migrated: UserData = {
          version: 1,
          watchlist: legacy.data.watchlist,
          portfolios: legacy.data.portfolio.length
            ? [{ id: "default", name: "내 포트폴리오", holdings: legacy.data.portfolio }]
            : [],
          activePortfolioId: legacy.data.portfolio.length ? "default" : null,
        };
        this.save(migrated);
        return deduplicate(migrated);
      }
    } catch {
      // Corrupt data is recovered as empty without exposing the raw value.
    }
    return emptyUserData();
  }

  save(data: UserData): void {
    this.storage.setItem(KEY, JSON.stringify(deduplicate(userDataSchema.parse(data))));
  }

  clear(): void {
    this.storage.removeItem(KEY);
  }
}

function deduplicate(data: UserData): UserData {
  const unique = <T extends { symbol: string; exchange: string }>(items: readonly T[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.exchange}:${item.symbol}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  return {
    ...data,
    watchlist: unique(data.watchlist),
    portfolios: data.portfolios.map((portfolio) => ({
      ...portfolio,
      holdings: unique(portfolio.holdings),
    })),
  };
}

export function canAdd(currentCount: number, appliedLimit: number): boolean {
  return currentCount < appliedLimit;
}
export const userDataStorageKey = KEY;
