export type StoredInstrument = Readonly<{ symbol: string; exchange: string; name: string }>;
export type StoredHolding = StoredInstrument & Readonly<{ quantity: string }>;
export type StoredPortfolio = Readonly<{
  id: string;
  name: string;
  holdings: readonly StoredHolding[];
}>;
export type UserData = Readonly<{
  version: 1;
  watchlist: readonly StoredInstrument[];
  portfolios: readonly StoredPortfolio[];
  activePortfolioId: string | null;
}>;

export interface UserDataRepository {
  load(): UserData;
  save(data: UserData): void;
  clear(): void;
}
