import { NextResponse } from "next/server";

import { ensureMarketRuntime, marketRuntime } from "@/composition/market-runtime";
import { createDiagnosticError } from "@/composition/diagnostics";

export async function POST() {
  try {
    await ensureMarketRuntime();
    marketRuntime.engine.resetAll();
    return NextResponse.json({ status: "reset" });
  } catch (error) {
    return NextResponse.json(
      createDiagnosticError(
        "COLLECTION_RESET_FAILED",
        "데이터 수집 상태를 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        true,
        error,
      ),
      { status: 503 },
    );
  }
}
