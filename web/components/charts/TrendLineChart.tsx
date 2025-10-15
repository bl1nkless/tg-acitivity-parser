"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface TrendLineChartProps {
  data: Array<{ bucket_start: string; online_seconds: number }>;
}

const TrendLineChart = ({ data }: TrendLineChartProps) => {
  const option = useMemo(() => {
    const dayMap = new Map<string, number>();
    for (const item of data) {
      const date = new Date(item.bucket_start);
      const dayKey = date.toISOString().slice(0, 10);
      const current = dayMap.get(dayKey) ?? 0;
      dayMap.set(dayKey, current + item.online_seconds / 60);
    }

    const seriesData = Array.from(dayMap.entries()).sort(([a], [b]) => (a > b ? 1 : -1));

    return {
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          const minutes = params[0].data[1];
          return `${params[0].data[0]}<br/>Online ${minutes.toFixed(1)} min`;
        }
      },
      xAxis: {
        type: "category",
        data: seriesData.map(([day]) => day),
        axisLine: { lineStyle: { color: "#64748b" } },
        axisLabel: { color: "#94a3b8" }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "#1e293b" } }
      },
      grid: { top: 20, bottom: 50, left: 60, right: 10 },
      series: [
        {
          type: "line",
          data: seriesData.map(([day, minutes]) => [day, Number(minutes.toFixed(2))]),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: "#22d3ee", width: 3 },
          areaStyle: {
            color: "rgba(34, 211, 238, 0.12)"
          }
        }
      ]
    };
  }, [data]);

  return <ReactECharts option={option} style={{ height: 260 }} notMerge />;
};

export default TrendLineChart;
