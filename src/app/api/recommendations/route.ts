import Decimal from "decimal.js";
import { NextRequest, NextResponse } from "next/server";

import { marketRuntime } from "@/composition/market-runtime";
import { backtestRecommendation, createInstrumentId, recommendations } from "@/domain";

const periodDays = {
  "6m": 183,
  "1y": 366,
  "3y": 1096,
  "5y": 1827,
  "7y": 2557,
  "10y": 3653,
} as const;

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get("period") as keyof typeof periodDays | null;
    const days = period && period in periodDays ? periodDays[period] : periodDays["10y"];
    const end = marketRuntime.now();
    const start = end.subtract({ hours: days * 24 });
    const uniqueAssets = new Map(
      recommendations.flatMap(({ assets }) => assets).map((asset) => [asset.symbol, asset]),
    );
    const [rates, histories] = await Promise.all([
      marketRuntime.provider.getExchangeRates({
        baseCurrency: "USD",
        quoteCurrency: "KRW",
        periodStart: start,
        periodEnd: end,
      }),
      Promise.all(
        [...uniqueAssets.values()].map(async (asset) => ({
          asset,
          values: await marketRuntime.provider.getOhlcv({
            instrument: createInstrumentId(asset.symbol, asset.exchange),
            interval: "1d",
            periodStart: start,
            periodEnd: end,
          }),
        })),
      ),
    ]);
    const sortedRates = rates.map(({ marketTimestamp, rate }) => ({
      date: marketTimestamp.toZonedDateTimeISO("UTC").toPlainDate(),
      rate: rate.value,
    }));
    const krwSeries = histories.map(({ asset, values }) => ({
      symbol: asset.symbol,
      values: values.flatMap(({ timestamp, adjustedClose }) => {
        const date = timestamp.toZonedDateTimeISO("UTC").toPlainDate();
        const rate = [...sortedRates]
          .reverse()
          .find((candidate) => candidate.date.toString() <= date.toString());
        return rate ? [{ date, value: adjustedClose.value.mul(rate.rate) }] : [];
      }),
    }));
    const latestBySymbol = new Map(
      krwSeries.map(({ symbol, values }) => [symbol, values.at(-1)?.value]),
    );
    const results = recommendations.map((recommendation) => {
      const result = backtestRecommendation(
        recommendation,
        krwSeries.filter(({ symbol }) =>
          recommendation.assets.some((asset) => asset.symbol === symbol),
        ),
      );
      return {
        id: recommendation.id,
        name: recommendation.name,
        description: recommendation.description,
        startDate: result.startDate.toString(),
        endDate: result.endDate.toString(),
        assets: recommendation.assets.map((asset) => ({
          symbol: asset.symbol,
          exchange: asset.exchange,
          weight: asset.weight.toString(),
          quantity: new Decimal("10000000")
            .mul(asset.weight)
            .div(100)
            .div(latestBySymbol.get(asset.symbol) ?? 1)
            .toDecimalPlaces(6)
            .toString(),
        })),
        metrics: {
          cumulativeReturn: result.metrics.cumulativeReturn.mul(100).toString(),
          cagr: result.metrics.cagr?.mul(100).toString() ?? null,
          annualizedVolatility: result.metrics.annualizedVolatility.mul(100).toString(),
          maximumDrawdown: result.metrics.maximumDrawdown.value.mul(100).toString(),
          peakDate: result.metrics.maximumDrawdown.peakDate.toString(),
          troughDate: result.metrics.maximumDrawdown.troughDate.toString(),
        },
        assumptions: result.assumptions,
      };
    });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      {
        code: "RECOMMENDATIONS_FAILED",
        message: "추천 포트폴리오 백테스트를 불러오지 못했습니다.",
        retryable: true,
      },
      { status: 502 },
    );
  }
}
