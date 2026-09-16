import Decimal from "decimal.js";
import { Temporal } from "@js-temporal/polyfill";
import { NextRequest, NextResponse } from "next/server";

import { marketRuntime } from "@/composition/market-runtime";
import { calculateHistoricalEstimatedValue, createInstrumentId, planAnalysisStart } from "@/domain";
import { portfolioAnalysisRequestSchema } from "@/contracts";

const days = { "6m": 183, "1y": 366, "3y": 1096, "5y": 1827, "7y": 2557, "10y": 3653 } as const;

export async function POST(request: NextRequest) {
  try {
    const input = portfolioAnalysisRequestSchema.parse(await request.json());
    const end = marketRuntime.now();
    const requestedStartInstant = end.subtract({ hours: days[input.period] * 24 });
    const requestedStart = requestedStartInstant.toZonedDateTimeISO("UTC").toPlainDate();
    const assets = await Promise.all(
      input.holdings.map(async (holding) => {
        const instrument = createInstrumentId(holding.symbol, holding.exchange);
        const [detail, prices] = await Promise.all([
          marketRuntime.provider.getInstrumentDetails(instrument),
          marketRuntime.provider.getOhlcv({
            instrument,
            interval: "1d",
            periodStart: requestedStartInstant,
            periodEnd: end,
          }),
        ]);
        const first = prices[0];
        const last = prices.at(-1);
        if (!first || !last) throw new Error("empty price history");
        return {
          holding,
          instrument,
          currency: detail.quote.currency,
          prices,
          range: {
            instrument,
            firstAvailableDate: first.timestamp.toZonedDateTimeISO("UTC").toPlainDate(),
            lastAvailableDate: last.timestamp.toZonedDateTimeISO("UTC").toPlainDate(),
          },
        };
      }),
    );
    const plan = planAnalysisStart(
      requestedStart,
      assets.map(({ range }) => range),
      input.strategy,
    );
    if (plan.cancelled)
      return NextResponse.json({
        status: "cancelled",
        requestedStart: requestedStart.toString(),
        actualStart: null,
        endDate: end.toZonedDateTimeISO("UTC").toPlainDate().toString(),
        affected: plan.affected.map(({ instrument, firstAvailableDate }) => ({
          symbol: instrument.symbol,
          firstAvailableDate: firstAvailableDate.toString(),
        })),
        excluded: [],
        values: [],
        appliedExchangeRateDates: {},
      });
    const includedKeys = new Set(
      plan.included.map(({ instrument }) => `${instrument.exchange}:${instrument.symbol}`),
    );
    const included = assets.filter(({ instrument }) =>
      includedKeys.has(`${instrument.exchange}:${instrument.symbol}`),
    );
    const rates = included.some(({ currency }) => currency === "USD")
      ? await marketRuntime.provider.getExchangeRates({
          baseCurrency: "USD",
          quoteCurrency: "KRW",
          periodStart: requestedStartInstant,
          periodEnd: end,
        })
      : [];
    const result = calculateHistoricalEstimatedValue(
      included.map(({ holding, instrument, currency, prices }) => ({
        symbol: instrument.symbol,
        quantity: new Decimal(holding.quantity),
        currency,
        prices: prices
          .filter(
            ({ timestamp }) =>
              !plan.actualStart ||
              Temporal.PlainDate.compare(
                timestamp.toZonedDateTimeISO("UTC").toPlainDate(),
                plan.actualStart,
              ) >= 0,
          )
          .map(({ timestamp, adjustedClose }) => ({
            date: timestamp.toZonedDateTimeISO("UTC").toPlainDate(),
            value: adjustedClose.value,
          })),
      })),
      rates.map(({ marketTimestamp, rate }) => ({
        date: marketTimestamp.toZonedDateTimeISO("UTC").toPlainDate(),
        rate: rate.value,
      })),
    );
    return NextResponse.json({
      status: "completed",
      requestedStart: requestedStart.toString(),
      actualStart: result.values[0]?.date.toString() ?? plan.actualStart?.toString() ?? null,
      endDate:
        result.values.at(-1)?.date.toString() ??
        end.toZonedDateTimeISO("UTC").toPlainDate().toString(),
      affected: plan.affected.map(({ instrument, firstAvailableDate }) => ({
        symbol: instrument.symbol,
        firstAvailableDate: firstAvailableDate.toString(),
      })),
      excluded: plan.excluded.map(({ asset }) => ({
        symbol: asset.instrument.symbol,
        reason: "short-history",
      })),
      values: result.values.map(({ date, value }) => ({
        date: date.toString(),
        valueKrw: value.toString(),
      })),
      appliedExchangeRateDates: result.appliedExchangeRateDates,
    });
  } catch {
    return NextResponse.json(
      {
        code: "PORTFOLIO_ANALYSIS_FAILED",
        message: "과거 추정 가치 분석을 완료하지 못했습니다.",
        retryable: true,
      },
      { status: 422 },
    );
  }
}
