"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

type PriceTrendChartProps = {
  labels: string[];
  prices: number[];
  predictions?: (number | null)[];
  // All three come straight from the prices table row — no derivation
  currentPrice: number | null;
  previousPrice: number | null;
  predictedPrice: number | null;
  range: number;
  onRangeChange: (range: number) => void;
};

const RANGES = [
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
];

export default function PriceTrendChart({
  labels,
  prices,
  predictions = [],
  currentPrice,
  previousPrice,
  predictedPrice,
  range,
  onRangeChange,
}: PriceTrendChartProps) {
  const slicedLabels = labels.slice(-range);
  const slicedPrices = prices.slice(-range);
  const slicedPredictions = predictions.slice(-range);

  // Period average from actual history slice
  const validPrices = slicedPrices.filter((p) => p != null && !isNaN(p));
  const periodAvg =
    validPrices.length > 0
      ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length)
      : null;

  // % change between DB current and DB previous price
  const priceChange =
    currentPrice != null && previousPrice != null && previousPrice !== 0
      ? (((currentPrice - previousPrice) / previousPrice) * 100).toFixed(1)
      : null;
  const priceUp = priceChange !== null && parseFloat(priceChange) >= 0;

  // Confidence band ±5% around prediction line
  const bandHigh = slicedPredictions.map((p) =>
    p != null ? Math.round((p as number) * 1.05) : null
  );
  const bandLow = slicedPredictions.map((p) =>
    p != null ? Math.round((p as number) * 0.95) : null
  );

  const chartData = {
    labels: slicedLabels,
    datasets: [
      {
        label: "__band_high",
        data: bandHigh,
        borderColor: "transparent",
        backgroundColor: "rgba(234,179,8,0.10)",
        fill: "+1",
        pointRadius: 0,
        tension: 0.4,
        order: 4,
      },
      {
        label: "__band_low",
        data: bandLow,
        borderColor: "transparent",
        backgroundColor: "rgba(234,179,8,0.10)",
        fill: false,
        pointRadius: 0,
        tension: 0.4,
        order: 5,
      },
      {
        label: "Actual Price",
        data: slicedPrices,
        borderColor: "#16a34a",
        backgroundColor: "rgba(22,163,74,0.10)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: "#16a34a",
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#16a34a",
        borderWidth: 2.5,
        spanGaps: false,
        order: 1,
      },
      {
        label: "Predicted Price",
        data: slicedPredictions,
        borderColor: "#d97706",
        backgroundColor: "transparent",
        borderDash: [6, 4],
        fill: false,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: "#d97706",
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#d97706",
        borderWidth: 2,
        spanGaps: false,
        order: 2,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#ffffff",
        borderColor: "rgba(0,0,0,0.08)",
        borderWidth: 1,
        titleColor: "#111827",
        bodyColor: "#6b7280",
        padding: 12,
        callbacks: {
          label: (ctx: any) => {
            if (ctx.dataset.label.startsWith("__")) return null;
            if (ctx.raw == null) return null;
            return `  ${ctx.dataset.label}: ZMW ${ctx.raw}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: "#9ca3af", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        border: { display: false },
      },
      y: {
        grid: { color: "rgba(156,163,175,0.15)", drawTicks: false },
        ticks: { font: { size: 11 }, color: "#9ca3af", callback: (v: number) => `ZMW ${v}`, padding: 8 },
        border: { display: false },
      },
    },
  };

  return (
    <div className="space-y-4">
      {/* Metric cards — values are DB props, not derived */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Current price</p>
          <p className="text-lg font-semibold text-gray-900">
            {currentPrice != null ? `ZMW ${currentPrice.toFixed(2)}` : "—"}
          </p>
          {priceChange !== null ? (
            <div className={`flex items-center gap-1 text-xs mt-1 font-medium ${priceUp ? "text-green-600" : "text-red-500"}`}>
              {priceUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {priceUp ? "+" : ""}{priceChange}% vs prev
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1">No previous data</p>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">AI forecast</p>
          <p className="text-lg font-semibold text-gray-900">
            {predictedPrice != null ? `ZMW ${predictedPrice.toFixed(2)}` : "—"}
          </p>
          <p className="text-xs text-amber-600 mt-1">● Next period</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">{range}-day avg</p>
          <p className="text-lg font-semibold text-gray-900">
            {periodAvg != null ? `ZMW ${periodAvg}` : "—"}
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
            <Minus className="w-3 h-3" /> From history
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-gray-500">
        <span className="flex items-center gap-2">
          <span className="w-6 h-0.5 bg-green-600 rounded inline-block" />
          Actual price
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 inline-block" style={{ borderTop: "2px dashed #d97706", height: 0 }} />
          Predicted
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 h-2.5 rounded inline-block bg-yellow-100 border border-yellow-200" />
          Confidence band
        </span>
      </div>

      {/* Chart */}
      <div className="relative w-full h-64">
        <Line data={chartData} options={options} />
      </div>

      {/* Range buttons */}
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => onRangeChange(r.value)}
            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
              range === r.value
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}