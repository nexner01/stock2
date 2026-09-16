import { canAdd, LocalUserDataRepository, userDataStorageKey } from "./local-user-data-repository";

describe("LocalUserDataRepository", () => {
  beforeEach(() => localStorage.clear());

  it("version 1 데이터를 저장하고 복원한다", () => {
    const repository = new LocalUserDataRepository(localStorage);
    repository.save({
      version: 1,
      watchlist: [],
      activePortfolioId: "main",
      portfolios: [
        {
          id: "main",
          name: "내 포트폴리오",
          holdings: [{ symbol: "AAPL", exchange: "XNAS", name: "Apple", quantity: "1.5" }],
        },
      ],
    });
    expect(repository.load().portfolios[0]?.holdings[0]?.quantity).toBe("1.5");
  });

  it("legacy 데이터를 version 1로 migration한다", () => {
    localStorage.setItem(
      userDataStorageKey,
      JSON.stringify({
        watchlist: [],
        portfolio: [{ symbol: "AAPL", exchange: "XNAS", name: "Apple", quantity: "2" }],
      }),
    );
    const result = new LocalUserDataRepository(localStorage).load();
    expect(result.version).toBe(1);
    expect(result.activePortfolioId).toBe("default");
  });

  it("손상 데이터는 빈 상태로 복구하고 중복 종목을 제거한다", () => {
    const repository = new LocalUserDataRepository(localStorage);
    localStorage.setItem(userDataStorageKey, "{broken");
    expect(repository.load().portfolios).toEqual([]);
    repository.save({
      version: 1,
      watchlist: [],
      activePortfolioId: "p",
      portfolios: [
        {
          id: "p",
          name: "P",
          holdings: [
            { symbol: "AAPL", exchange: "XNAS", name: "Apple", quantity: "1" },
            { symbol: "AAPL", exchange: "XNAS", name: "Apple", quantity: "2" },
          ],
        },
      ],
    });
    expect(repository.load().portfolios[0]?.holdings).toHaveLength(1);
  });

  it("한도 축소는 기존 데이터를 지우지 않고 신규 추가만 막는다", () => {
    expect(canAdd(10, 5)).toBe(false);
    expect(canAdd(4, 5)).toBe(true);
  });

  it("0 이하 수량은 저장하지 않는다", () => {
    const repository = new LocalUserDataRepository(localStorage);
    expect(() =>
      repository.save({
        version: 1,
        watchlist: [],
        activePortfolioId: "p",
        portfolios: [
          {
            id: "p",
            name: "P",
            holdings: [{ symbol: "AAPL", exchange: "XNAS", name: "Apple", quantity: "0" }],
          },
        ],
      }),
    ).toThrow();
  });
});
