"use client";
import { useEffect, useState } from "react";
import Chart from "chart.js/auto";

export default function ComparisonChart({ crops, markets }: { crops: string[]; markets: string[] }) {
  const [chartData, setChartData] = useState<any>(null);

  async function fetchComparison() {
    const params = new URLSearchParams();
    crops.forEach(c => params.append("crop", c));
    markets.forEach(m => params.append("market", m));

    const res = await fetch(`/api/admin/compare?${params.toString()}`);
    const data = await res.json();
    setChartData(data);
  }

  useEffect(() => {
    fetchComparison();

    const socket = (window as any).io?.("/api/socket");
    socket?.on("priceUpdate", fetchComparison);
    return () => socket?.off("priceUpdate", fetchComparison);
  }, [crops, markets]);

  useEffect(() => {
    if (!chartData) return;

    const ctx = (document.getElementById("comparisonChart") as HTMLCanvasElement)?.getContext("2d");
    if (!ctx) return;

    new Chart(ctx, {
      type: "line",
      data: {
        labels: chartData[0]?.labels || [],
        datasets: chartData.flatMap((item: any) => [
          {
            label: `${item.crop} (${item.market})`,
            data: item.actualPrices,
            borderColor: "blue",
          },
          {
            label: `${item.crop} (${item.market}) Prediction`,
            data: item.predictions,
            borderColor: "red",
            borderDash: [5, 5],
          },
        ]),
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        stacked: false,
      },
    });
  }, [chartData]);

  return <canvas id="comparisonChart" height={400}></canvas>;
}