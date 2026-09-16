import { Temporal } from "@js-temporal/polyfill";
import { NextRequest, NextResponse } from "next/server";

import { createInstrumentId } from "@/domain";
import { marketRuntime } from "@/composition/market-runtime";
import { createDiagnosticError } from "@/composition/diagnostics";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ exchange: string; symbol: string }> },
) {
  try {
    const { exchange, symbol } = await context.params;
    const instrument = createInstrumentId(symbol, exchange);
    const period = marketRuntime.periodFor(request.nextUrl.searchParams.get("period") ?? "5y");
    const end = marketRuntime.now();
    const start = end.subtract({ hours: period.days * 24 });
    const [details, ohlcv] = await Promise.all([
      marketRuntime.provider.getInstrumentDetails(instrument),
      marketRuntime.provider.getOhlcv({
        instrument,
        interval: period.interval,
        periodStart: start,
        periodEnd: end,
      }),
    ]);
    const first = ohlcv.at(0)?.timestamp ?? null;
    const last = ohlcv.at(-1)?.timestamp ?? null;
    return NextResponse.json({
      quote: {
        symbol: details.quote.instrument.symbol,
        exchange: details.quote.instrument.exchange,
        name: details.quote.name,
        currency: details.quote.currency,
        price: details.quote.price.value.toString(),
        previousClose: details.quote.previousClose.value.toString(),
        changePercent: details.quote.changePercent.value.toString(),
        marketStatus: details.quote.marketStatus,
        marketTimestamp: details.quote.marketTimestamp.toString(),
        collectedAt: details.quote.collectedAt.toString(),
      },
      range: first && last ? { start: first.toString(), end: last.toString() } : null,
      interval: period.interval,
      ohlcv: ohlcv.map((value) => ({
        timestamp: value.timestamp.toString(),
        open: value.open.value.toString(),
        high: value.high.value.toString(),
        low: value.low.value.toString(),
        close: value.close.value.toString(),
        adjustedClose: value.adjustedClose.value.toString(),
        volume: value.volume.value.toString(),
      })),
      generatedAt: Temporal.Now.instant().toString(),
    });
  } catch (error) {
    return NextResponse.json(
      createDiagnosticError(
        "INSTRUMENT_FAILED",
        "종목 시계열을 불러오지 못했습니다. 종목과 거래소를 확인해 주세요.",
        true,
        error,
      ),
      { status: 502 },
    );
  }
}
