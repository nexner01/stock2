import { vi } from "vitest";

import { syncMarketSubscriptions } from "./browser-user-data";

describe("syncMarketSubscriptions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("관심 종목과 활성 포트폴리오 식별자만 서버 메모리 구독으로 보낸다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      syncMarketSubscriptions({
        version: 1,
        watchlist: [{ symbol: "AAPL", exchange: "XNAS", name: "Apple" }],
        activePortfolioId: "active",
        portfolios: [
          {
            id: "active",
            name: "내 포트폴리오",
            holdings: [{ symbol: "MSFT", exchange: "XNAS", name: "Microsoft", quantity: "2.5" }],
          },
        ],
      }),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith("/api/market/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        watchlist: [{ symbol: "AAPL", exchange: "XNAS" }],
        portfolio: [{ symbol: "MSFT", exchange: "XNAS" }],
      }),
    });
  });
});
