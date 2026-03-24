"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import {
  ChevronRight, TrendingUp, TrendingDown, Minus,
  MapPin, AlertCircle, Loader2, RefreshCw,
} from "lucide-react";

interface Insight {
  cropId: string;
  cropName: string;
  summary: string;
  trendDirection: "up" | "down" | "stable";
  trendPct: number;
  avgCurrentPrice: number;
  priceRange: string;
  bestSellWindow: string;
  bestMarket: string | null;
  dataPoints: number;
  marketsCount: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/farmer/insights", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to fetch insights");
      const data: ApiResponse<Insight[]> = await res.json();
      if (!data.success || !data.data) throw new Error("Invalid response");
      setInsights(data.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Insights fetch error:", err);
      setError("Failed to load market insights. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInsights(); }, []);

  const TrendBadge = ({ direction, pct }: { direction: Insight["trendDirection"]; pct: number }) => {
    const configs = {
      up: {
        icon: <TrendingUp className="w-3.5 h-3.5" />,
        label: `+${pct}%`,
        className: "bg-green-100 text-green-700",
      },
      down: {
        icon: <TrendingDown className="w-3.5 h-3.5" />,
        label: `-${Math.abs(pct)}%`,
        className: "bg-red-100 text-red-600",
      },
      stable: {
        icon: <Minus className="w-3.5 h-3.5" />,
        label: "Stable",
        className: "bg-gray-100 text-gray-600",
      },
    };
    const c = configs[direction];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
        {c.icon}{c.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-green-50 p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Market Insights</h1>
          <p className="text-gray-600 mt-1">
            Data-driven insights generated from live price and forecast data.
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-1">
              Last updated {lastUpdated.toLocaleTimeString("en-ZM")}
            </p>
          )}
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-100 border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <div className="p-4 sm:p-6 animate-pulse space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-5 bg-gray-200 rounded w-1/3" />
                  <div className="h-5 bg-gray-100 rounded w-16" />
                </div>
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-px bg-gray-100" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && insights.length === 0 && !error && (
        <div className="text-center py-20">
          <TrendingUp className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 mb-1">No insights available yet</p>
          <p className="text-sm text-gray-400">
            Insights are generated once price and forecast data is available in the database.
          </p>
        </div>
      )}

      {/* Insight cards */}
      {!loading && insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insights.map((insight) => (
            <Card key={insight.cropId} className="hover:shadow-lg transition-shadow">
              <div className="p-4 sm:p-6">
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {insight.cropName} Market
                  </h3>
                  <TrendBadge direction={insight.trendDirection} pct={insight.trendPct} />
                </div>

                {/* Summary */}
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  {insight.summary}
                </p>

                {/* Metrics */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Current avg price</span>
                    <span className="font-medium text-gray-900">
                      ZMW {insight.avgCurrentPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Forecast range</span>
                    <span className="font-medium text-gray-900">{insight.priceRange}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Best time to sell</span>
                    <span className="font-medium text-green-700">{insight.bestSellWindow}</span>
                  </div>
                  {insight.bestMarket && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Best market</span>
                      <span className="font-medium text-gray-900 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {insight.bestMarket}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {insight.dataPoints} data points · {insight.marketsCount}{" "}
                    {insight.marketsCount === 1 ? "market" : "markets"}
                  </span>
                  <a
                    href={`/dashboard/farmer/prices?crop=${encodeURIComponent(insight.cropName)}`}
                    className="inline-flex items-center text-green-600 hover:text-green-700 text-sm font-medium"
                  >
                    View price history <ChevronRight className="w-4 h-4 ml-1" />
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}