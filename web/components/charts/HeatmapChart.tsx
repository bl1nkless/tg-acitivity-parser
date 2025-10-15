"use client";

import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import type { HeatmapCell } from "@/lib/api";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const hours = Array.from({ length: 24 }, (_, index) => index);
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface HeatmapChartProps {
  data: HeatmapCell[];
}

const HeatmapChart = memo(function HeatmapChart({ data }: HeatmapChartProps) {
  const chartOption = useMemo(() => {
    const dataset = data.map((cell) => [cell.hour, cell.weekday, cell.online_seconds / 60]);
    const maxMinutes = data.reduce((acc, cell) => Math.max(acc, cell.online_seconds / 60), 1);

    return {
      tooltip: {
        formatter: (params: any) => {
          const minutes = params.data[2];
          return `${weekdays[params.data[1]]} ${params.data[0]}:00<br/>Online ${minutes.toFixed(1)} min`;
        }
      },
      grid: {
        top: 10,
        bottom: 30,
        left: 80,
        right: 10
      },
      xAxis: {
        type: "category",
        data: hours,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#64748b" } },
        axisLabel: {
          color: "#94a3b8",
          formatter: (value: number) => `${value}:00`
        }
      },
      yAxis: {
        type: "category",
        data: weekdays,
        axisLine: { lineStyle: { color: "#64748b" } },
        axisLabel: { color: "#94a3b8" }
      },
      visualMap: {
        show: true,
        min: 0,
        max: Math.max(maxMinutes, 1),
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        textStyle: { color: "#cbd5f5" },
        inRange: {
          color: ["#0f172a", "#1d4ed8", "#22d3ee"]
        }
      },
      series: [
        {
          type: "heatmap",
          data: dataset,
          label: {
            show: false
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.5)"
            }
          }
        }
      ]
    };
  }, [data]);

  return <ReactECharts option={chartOption} style={{ height: 320 }} notMerge lazyUpdate />;
});

export default HeatmapChart;
