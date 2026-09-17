import { NextResponse } from "next/server";

import { ensureMarketRuntime, marketRuntime } from "@/composition/market-runtime";
import { createDiagnosticError } from "@/composition/diagnostics";
import type { CollectionGroup } from "@/ports";

const groups: readonly CollectionGroup[] = ["indices", "popular", "watchlist", "portfolio"];
const isCollectionGroup = (value: string): value is CollectionGroup =>
  groups.some((group) => group === value);

export async function POST(_request: Request, context: { params: Promise<{ group: string }> }) {
  try {
    const { group } = await context.params;
    if (!isCollectionGroup(group)) {
      return NextResponse.json(
        {
          code: "INVALID_COLLECTION_GROUP",
          message: "알 수 없는 데이터 그룹입니다.",
          retryable: false,
        },
        { status: 400 },
      );
    }
    await ensureMarketRuntime();
    marketRuntime.engine.retryGroup(group);
    return NextResponse.json({ group, status: "retrying" });
  } catch (error) {
    return NextResponse.json(
      createDiagnosticError(
        "COLLECTION_GROUP_RETRY_FAILED",
        "데이터 그룹을 다시 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        true,
        error,
      ),
      { status: 503 },
    );
  }
}
