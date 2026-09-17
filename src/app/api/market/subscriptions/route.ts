import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureMarketRuntime, marketRuntime } from "@/composition/market-runtime";
import { createDiagnosticError } from "@/composition/diagnostics";
import { createInstrumentId } from "@/domain";

const instrumentSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  exchange: z.string().trim().min(1).max(16),
});
const requestSchema = z.object({
  watchlist: z.array(instrumentSchema).max(1_000),
  portfolio: z.array(instrumentSchema).max(1_000),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const watchlist = input.watchlist.map(({ symbol, exchange }) =>
      createInstrumentId(symbol, exchange),
    );
    const portfolio = input.portfolio.map(({ symbol, exchange }) =>
      createInstrumentId(symbol, exchange),
    );
    marketRuntime.setBrowserSubscriptions(watchlist, portfolio);
    await ensureMarketRuntime();
    return NextResponse.json({ watchlist: watchlist.length, portfolio: portfolio.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "INVALID_MARKET_SUBSCRIPTIONS",
          message: "관심 종목 또는 포트폴리오 종목 형식이 올바르지 않습니다.",
          retryable: false,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      createDiagnosticError(
        "MARKET_SUBSCRIPTION_SYNC_FAILED",
        "자동 조회 종목을 동기화하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        true,
        error,
      ),
      { status: 503 },
    );
  }
}
