"use client";

import * as echarts from "echarts";
import { useEffect, useRef } from "react";

import type { PortfolioAnalysisDto } from "@/contracts";

export function HistoricalValueChart({ result }: Readonly<{ result: PortfolioAnalysisDto }>) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current, undefined, { renderer: "svg" });
    chart.setOption({
      animation: false,
      grid: { left: 68, right: 20, top: 18, bottom: 42 },
      tooltip: { trigger: "axis", backgroundColor: "#0b1220", borderColor: "#334155" },
      xAxis: {
        type: "category",
        data: result.values.map(({ date }) => date),
        axisLabel: { color: "#7f8da3", hideOverlap: true },
        axisLine: { lineStyle: { color: "#263246" } },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#7f8da3",
          formatter: (value: number) => `${Math.round(value / 10000)}만`,
        },
        splitLine: { lineStyle: { color: "#1f2a3b" } },
      },
      series: [
        {
          type: "line",
          data: result.values.map(({ valueKrw }) => Number(valueKrw)),
          showSymbol: false,
          smooth: true,
          lineStyle: { color: "#ef4444", width: 2 },
          areaStyle: { color: "rgba(239,68,68,.12)" },
        },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [result]);
  return (
    <>
      <div
        ref={element}
        className="historical-chart"
        role="img"
        aria-label="현재 보유 수량 기준 과거 추정 가치 차트"
      />
      <p className="sr-only">
        {result.actualStart}부터 {result.endDate}까지 {result.values.length}개 관측값. 마지막 추정
        가치 {result.values.at(-1)?.valueKrw ?? "없음"}원.
      </p>
    </>
  );
}
