import { NextResponse } from "next/server";

import { marketRuntime } from "@/composition/market-runtime";
import { createDiagnosticError } from "@/composition/diagnostics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const periodEnd = marketRuntime.now();
    const [rate] = await marketRuntime.provider.getExchangeRates({
      baseCurrency: "USD",
      quoteCurrency: "KRW",
      periodStart: periodEnd.subtract({ hours: 7 * 24 }),
      periodEnd,
    });
    if (!rate) throw new Error("empty exchange rate");
    return NextResponse.json({
      base: "USD",
      quote: "KRW",
      rate: rate.rate.value.toString(),
      marketTimestamp: rate.marketTimestamp.toString(),
      collectedAt: rate.collectedAt.toString(),
    });
  } catch (error) {
    return NextResponse.json(
      createDiagnosticError("FX_FAILED", "원화 환율을 불러오지 못했습니다.", true, error),
      { status: 502 },
    );
  }
}
