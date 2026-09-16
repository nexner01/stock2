import { NextResponse } from "next/server";

import { ensureMarketRuntime, marketRuntime } from "@/composition/market-runtime";
import type { CollectionGroup } from "@/ports";

export const dynamic = "force-dynamic";

const groupIds: readonly CollectionGroup[] = ["indices", "popular", "watchlist", "portfolio"];

export async function GET() {
  try {
    await ensureMarketRuntime();
    return NextResponse.json({
      pollIntervalSeconds: marketRuntime.config.realtime.poll_interval_seconds,
      limits: {
        watchlistMaxSymbols: marketRuntime.config.limits.watchlist_max_symbols,
        portfolioMaxSymbols: marketRuntime.config.limits.portfolio_max_symbols,
      },
      groups: groupIds.map((id) => {
        const state = marketRuntime.engine.state(id);
        return {
          id,
          status: state.status,
          lastHealthyAt: state.lastHealthyAt?.toString() ?? null,
          skipped: state.metrics.skipped,
          values: state.values.map((value) => ({
            symbol: value.instrument.symbol,
            exchange: value.instrument.exchange,
            name: value.name,
            currency: value.currency,
            price: value.price.value.toString(),
            previousClose: value.previousClose.value.toString(),
            changePercent: value.changePercent.value.toString(),
            marketStatus: value.marketStatus,
            marketTimestamp: value.marketTimestamp.toString(),
            collectedAt: value.collectedAt.toString(),
          })),
        };
      }),
    });
  } catch {
    return NextResponse.json(
      {
        code: "MARKET_RUNTIME_UNAVAILABLE",
        message: "시장 데이터 연결을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        retryable: true,
      },
      { status: 503 },
    );
  }
}
