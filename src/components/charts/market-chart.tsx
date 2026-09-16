"use client";

import * as echarts from "echarts";
import { useEffect, useRef } from "react";

import type { InstrumentDetailDto } from "@/contracts";

export function MarketChart({
  detail,
  type,
}: Readonly<{ detail: InstrumentDetailDto; type: "line" | "candle" }>) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const chart = echarts.init(container.current, undefined, { renderer: "svg" });
    const dates = detail.ohlcv.map(({ timestamp }) => timestamp.slice(0, 10));
    const candle = detail.ohlcv.map(({ open, close, low, high }) =>
      [open, close, low, high].map(Number),
    );
    const adjusted = detail.ohlcv.map(({ adjustedClose }) => Number(adjustedClose));
    const volumes = detail.ohlcv.map(({ volume }) => Number(volume));
    chart.setOption({
      animation: false,
      backgroundColor: "transparent",
      textStyle: { color: "#94a3b8", fontFamily: "Pretendard, system-ui, sans-serif" },
      tooltip: { trigger: "axis", borderColor: "#334155", backgroundColor: "#0b1220" },
      grid: [
        { left: 58, right: 22, top: 24, height: "62%" },
        { left: 58, right: 22, top: "75%", height: "15%" },
      ],
      xAxis: [
        {
          type: "category",
          data: dates,
          boundaryGap: type === "candle",
          axisLine: { lineStyle: { color: "#263246" } },
          axisLabel: { color: "#7f8da3", hideOverlap: true },
        },
        {
          type: "category",
          gridIndex: 1,
          data: dates,
          axisLabel: { show: false },
          axisLine: { lineStyle: { color: "#263246" } },
        },
      ],
      yAxis: [
        {
          scale: true,
          splitLine: { lineStyle: { color: "#1f2a3b" } },
          axisLabel: { color: "#7f8da3" },
        },
        {
          gridIndex: 1,
          splitNumber: 2,
          splitLine: { show: false },
          axisLabel: { color: "#7f8da3" },
        },
      ],
      series: [
        type === "candle"
          ? {
              type: "candlestick",
              data: candle,
              itemStyle: {
                color: "#ef4444",
                color0: "#3b82f6",
                borderColor: "#ef4444",
                borderColor0: "#3b82f6",
              },
            }
          : {
              type: "line",
              data: adjusted,
              showSymbol: false,
              smooth: true,
              lineStyle: { color: "#3b82f6", width: 2 },
              areaStyle: { color: "rgba(59,130,246,.14)" },
            },
        {
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes,
          itemStyle: { color: "#334a6d" },
        },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [detail, type]);

  const latest = detail.ohlcv.at(-1);
  return (
    <div>
      <div
        ref={container}
        className="market-chart"
        role="img"
        aria-label={`${detail.quote.name} ${type === "line" ? "조정 종가 라인" : "OHLC 캔들"} 차트와 거래량`}
      />
      <p className="sr-only">
        실제 데이터 범위 {detail.range?.start.slice(0, 10)}부터 {detail.range?.end.slice(0, 10)},
        간격 {detail.interval}, 최근 조정 종가 {latest?.adjustedClose ?? "없음"}{" "}
        {detail.quote.currency}
      </p>
    </div>
  );
}
