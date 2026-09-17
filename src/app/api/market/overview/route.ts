import { NextResponse } from "next/server";

import { ensureMarketRuntime, marketRuntime } from "@/composition/market-runtime";
import { createDiagnosticError } from "@/composition/diagnostics";
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
      provider: {
        requestTimeoutSeconds: marketRuntime.config.provider.request_timeout_seconds,
        batchSize: marketRuntime.config.provider.batch_size,
        maxSymbolsPerRequest: marketRuntime.config.provider.max_symbols_per_request,
      },
      groups: groupIds.map((id) => {
        const state = marketRuntime.engine.state(id);
        return {
          id,
          status: state.status,
          lastHealthyAt: state.lastHealthyAt?.toString() ?? null,
          skipped: state.metrics.skipped,
          consecutiveFailures: state.consecutiveFailures,
          stopped: state.stopped,
          batches: {
            total: state.lastBatchCount,
            successful: state.lastSuccessfulBatches,
            failed: state.lastFailedBatches,
          },
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
  } catch (error) {
    return NextResponse.json(
      createDiagnosticError(
        "MARKET_RUNTIME_UNAVAILABLE",
        "시장 데이터 연결을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        true,
        error,
      ),
      { status: 503 },
    );
  }
}
