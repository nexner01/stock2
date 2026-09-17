import type { UserData } from "@/ports";

export {
  canAdd,
  emptyUserData,
  LocalUserDataRepository,
  userDataStorageKey,
} from "@/infrastructure/persistence/browser/local-user-data-repository";

export async function syncMarketSubscriptions(data: UserData): Promise<boolean> {
  const active =
    data.portfolios.find(({ id }) => id === data.activePortfolioId) ?? data.portfolios[0];
  try {
    const response = await fetch("/api/market/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        watchlist: data.watchlist.map(({ symbol, exchange }) => ({ symbol, exchange })),
        portfolio: (active?.holdings ?? []).map(({ symbol, exchange }) => ({ symbol, exchange })),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
