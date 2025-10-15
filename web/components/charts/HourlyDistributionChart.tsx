"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface HourlyDistributionChartProps {
  data: Array<{ bucket_start: string; online_seconds: number }>;
  timezone: string;
}

const HourlyDistributionChart = ({ data }: HourlyDistributionChartProps) => {
  const option = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, index) => ({
      hour: index,
      minutes: 0
    }));

    for (const item of data) {
      const date = new Date(item.bucket_start);
      const hour = date.getUTCHours();
      buckets[hour].minutes += item.online_seconds / 60;
    }

    return {
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          const minuteValue = params[0].data;
          return `${params[0].axisValue}:00<br/>Online ${minuteValue.toFixed(1)} min`;
        }
      },
      xAxis: {
        type: "category",
        data: buckets.map((bucket) => bucket.hour),
        axisLabel: {
          color: "#94a3b8"
        },
        axisLine: { lineStyle: { color: "#64748b" } }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "#1e293b" } }
      },
      grid: { top: 20, bottom: 40, left: 50, right: 10 },
      series: [
        {
          data: buckets.map((bucket) => Number(bucket.minutes.toFixed(2))),
          type: "bar",
          itemStyle: {
            color: "#0ea5e9"
          }
        }
      ]
    };
  }, [data]);

  return <ReactECharts option={option} style={{ height: 260 }} notMerge />;
};

export default HourlyDistributionChart;
