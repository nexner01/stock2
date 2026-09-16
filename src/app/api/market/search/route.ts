import { NextRequest, NextResponse } from "next/server";

import { marketRuntime } from "@/composition/market-runtime";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json([]);
  try {
    const results = await marketRuntime.provider.search(query);
    return NextResponse.json(
      results.map((value) => ({
        symbol: value.instrument.symbol,
        exchange: value.instrument.exchange,
        name: value.name,
        currency: value.currency,
        price: value.currentPrice.value.toString(),
        changePercent: value.changePercent.value.toString(),
        marketTimestamp: value.marketTimestamp.toString(),
        collectedAt: value.collectedAt.toString(),
      })),
    );
  } catch {
    return NextResponse.json(
      { code: "SEARCH_FAILED", message: "검색 결과를 불러오지 못했습니다.", retryable: true },
      { status: 502 },
    );
  }
}
