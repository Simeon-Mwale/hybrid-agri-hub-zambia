"use client";

import { useEffect, useState } from "react";
import PriceTrendChart from "@/components/PriceTrendChart";
import { Card } from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import PriceManagementModal from "@/components/PriceManagementModal";
import {
  Users, Package, MapPin, MessageSquare, TrendingUp,
  AlertCircle, Bell, DollarSign, Plus, LogOut, RefreshCw,
  Loader2, Cpu
} from "lucide-react";

interface Stats {
  totalUsers: number;
  totalCrops: number;
  totalMarkets: number;
  pendingSMS: number;
  activeAlerts?: number;
  todayPrices?: number;
}

interface ChartData {
  labels: string[];
  prices: (number | null)[];
  predictions: (number | null)[];
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  createdAt?: string;
  status?: string;
  user?: string;
  metadata?: any;
}

interface Crop {
  id: string;
  name: string;
  category: string;
}

interface Market {
  id: string;
  name: string;
  province: string;
}

interface PriceData {
  id: string;
  cropId: string;
  marketId: string;
  price: number;
  priceDate: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalCrops: 0,
    totalMarkets: 0,
    pendingSMS: 0,
    activeAlerts: 0,
    todayPrices: 0,
  });

  const [chartData, setChartData] = useState<ChartData>({
    labels: [],
    prices: [],
    predictions: [],
  });

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [chartRange, setChartRange] = useState<number>(30);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [recentPrices, setRecentPrices] = useState<PriceData[]>([]);
  const [priceAction, setPriceAction] = useState<"add" | "edit" | "delete">("add");
  const [selectedPrice, setSelectedPrice] = useState<PriceData | null>(null);
  const [predicting, setPredicting] = useState(false);

  const [loading, setLoading] = useState({
    stats: true,
    chart: false,
    activities: true,
    crops: true,
    markets: true,
    prices: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentPrice   = [...chartData.prices].reverse().find((p) => p != null) ?? null;
  const previousPrice  = [...chartData.prices].reverse().filter((p) => p != null)[1] ?? null;
  const predictedPrice = chartData.predictions.find((p) => p != null) ?? null;

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-ZM", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const getActivityIcon = (type: string) => {
    const t = type?.toLowerCase();
    if (t?.includes("user"))       return <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"><Users className="w-4 h-4 text-blue-600" /></div>;
    if (t?.includes("price") || t?.includes("dataset")) return <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center"><TrendingUp className="w-4 h-4 text-green-600" /></div>;
    if (t?.includes("alert"))      return <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center"><AlertCircle className="w-4 h-4 text-red-600" /></div>;
    if (t?.includes("sms"))        return <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center"><MessageSquare className="w-4 h-4 text-yellow-600" /></div>;
    if (t?.includes("prediction")) return <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center"><Cpu className="w-4 h-4 text-purple-600" /></div>;
    return <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-600" /></div>;
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (res.ok) window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const fetchStats = async () => {
    const res = await fetch("/api/admin/stats", { credentials: "include" });
    if (res.ok) {
      const raw = await res.json();
      setStats(raw?.data ?? raw);
    }
  };

  const fetchRecentPrices = async () => {
    try {
      setLoading((prev) => ({ ...prev, prices: true }));
      const res = await fetch("/api/admin/prices?limit=5", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRecentPrices(Array.isArray(data) ? data : (data?.data ?? []));
      }
    } catch (err) {
      console.error("Recent prices error:", err);
    } finally {
      setLoading((prev) => ({ ...prev, prices: false }));
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch("/api/admin/activities?limit=10", { credentials: "include" });
      if (res.ok) {
        const raw = await res.json();
        setRecentActivities(Array.isArray(raw) ? raw : (raw?.data ?? []));
      }
    } catch {
      setRecentActivities([]);
    }
  };

  const fetchPriceTrends = async (crop: string, market: string) => {
    if (!crop || !market) return;
    try {
      setLoading((prev) => ({ ...prev, chart: true }));
      setError(null);
      const res = await fetch(
        `/api/admin/prices/trends?crop=${encodeURIComponent(crop)}&market=${encodeURIComponent(market)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load price trends");
      const raw = await res.json();
      const parsed: ChartData = raw?.data ?? raw;
      setChartData({
        labels:      parsed?.labels      ?? [],
        prices:      parsed?.prices      ?? [],
        predictions: parsed?.predictions ?? [],
      });
    } catch (err) {
      setError("Failed to load price trends");
      setChartData({ labels: [], prices: [], predictions: [] });
    } finally {
      setLoading((prev) => ({ ...prev, chart: false }));
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const cropsRes = await fetch("/api/admin/crops", { credentials: "include" });
        if (cropsRes.ok) {
          const raw = await cropsRes.json();
          const cropsData: Crop[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
          setCrops(cropsData);
          if (cropsData.length > 0) setSelectedCrop(cropsData[0].name);
        }

        const marketsRes = await fetch("/api/admin/markets", { credentials: "include" });
        if (marketsRes.ok) {
          const raw = await marketsRes.json();
          const marketsData: Market[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
          setMarkets(marketsData);
          if (marketsData.length > 0) setSelectedMarket(marketsData[0].name);
        }

        await Promise.all([fetchStats(), fetchActivities(), fetchRecentPrices()]);
      } catch (err) {
        setError("Failed to load dashboard data");
        console.error(err);
      } finally {
        setLoading({
          stats: false, chart: false, activities: false,
          crops: false, markets: false, prices: false,
        });
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedCrop && selectedMarket) {
      fetchPriceTrends(selectedCrop, selectedMarket);
    }
  }, [selectedCrop, selectedMarket]);

  const handleRefresh = async () => {
    setLoading((prev) => ({ ...prev, stats: true, activities: true }));
    await Promise.all([fetchStats(), fetchActivities(), fetchRecentPrices()]);
    if (selectedCrop && selectedMarket) await fetchPriceTrends(selectedCrop, selectedMarket);
    setLoading((prev) => ({ ...prev, stats: false, activities: false }));
    showSuccess("Dashboard refreshed");
  };

  // ── Price CRUD ──────────────────────────────────────────────────────────────

  const handleAddPrice = async (priceData: any) => {
    const res = await fetch("/api/admin/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(priceData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to add price");
    }
    await Promise.all([fetchRecentPrices(), fetchStats(), fetchActivities()]);
    if (selectedCrop && selectedMarket) await fetchPriceTrends(selectedCrop, selectedMarket);
    showSuccess("Price added successfully");
  };

  const handleUpdatePrice = async (id: string, priceData: any) => {
    const res = await fetch(`/api/admin/prices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(priceData),
    });
    if (!res.ok) throw new Error("Failed to update price");
    await fetchRecentPrices();
    showSuccess("Price updated successfully");
  };

  const handleDeletePrice = async (id: string) => {
    if (!confirm("Are you sure you want to delete this price?")) return;
    const res = await fetch(`/api/admin/prices/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to delete price");
    await Promise.all([fetchRecentPrices(), fetchStats()]);
    showSuccess("Price deleted");
  };

  // ── Run AI Predictions ──────────────────────────────────────────────────────

  const handleTriggerPredictions = async () => {
    setPredicting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/predictions/trigger", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(
          `AI predictions done — ${data.saved} saved across ${data.pairs} crop-market pairs`
        );
        await Promise.all([fetchActivities(), fetchPriceTrends(selectedCrop, selectedMarket)]);
      } else {
        setError(data.error || "Prediction failed. Is the Python service running?");
      }
    } catch {
      setError("Could not reach prediction service. Run: uvicorn main:app --reload --port 8000");
    } finally {
      setPredicting(false);
    }
  };

  // ── Quick Actions ───────────────────────────────────────────────────────────

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "sms":     window.location.href = "/dashboard/admin/sms-queue"; break;
      case "users":   window.location.href = "/dashboard/admin/users"; break;
      case "crops":   window.location.href = "/dashboard/admin/crops"; break;
      case "markets": window.location.href = "/dashboard/admin/markets"; break;
      case "prices":  setPriceAction("add"); setSelectedPrice(null); setShowPriceModal(true); break;
      case "predict": handleTriggerPredictions(); break;
    }
  };

  const statCards = [
    { key: "totalUsers",   label: "Total Users",    value: stats.totalUsers,        icon: Users,         color: "blue",   endpoint: "/dashboard/admin/users"      },
    { key: "totalCrops",   label: "Total Crops",    value: stats.totalCrops,        icon: Package,       color: "green",  endpoint: "/dashboard/admin/crops"      },
    { key: "totalMarkets", label: "Markets",        value: stats.totalMarkets,      icon: MapPin,        color: "purple", endpoint: "/dashboard/admin/markets"    },
    { key: "pendingSMS",   label: "Pending SMS",    value: stats.pendingSMS,        icon: MessageSquare, color: "yellow", endpoint: "/dashboard/admin/sms-queue"  },
    { key: "activeAlerts", label: "Active Alerts",  value: stats.activeAlerts ?? 0, icon: Bell,          color: "red",    endpoint: "/dashboard/admin/alerts"     },
    { key: "todayPrices",  label: "Today's Prices", value: stats.todayPrices  ?? 0, icon: DollarSign,    color: "indigo", endpoint: "/dashboard/admin/prices"     },
  ];

  const colorClasses: Record<string, string> = {
    blue:   "text-blue-600 bg-blue-100",
    green:  "text-green-600 bg-green-100",
    purple: "text-purple-600 bg-purple-100",
    yellow: "text-yellow-600 bg-yellow-100",
    red:    "text-red-600 bg-red-100",
    indigo: "text-indigo-600 bg-indigo-100",
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Monitor and manage your agricultural platform
            </p>
          </div>
          <div className="flex items-center gap-3">
            {successMessage && (
              <span className="text-sm text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                {successMessage}
              </span>
            )}
            <button onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
            <span className="flex-1 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600 text-lg">×</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {loading.stats ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
                <div className="h-8 bg-gray-300 rounded w-3/4" />
              </div>
            ))
          ) : (
            statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.key}
                  className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => (window.location.href = stat.endpoint)}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-lg ${colorClasses[stat.color]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                  </div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {stat.label}
                  </h3>
                </div>
              );
            })
          )}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Price Trends Chart */}
          <div className="lg:col-span-2">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Price Trends & Predictions
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Historical prices with AI forecast
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* ✅ Run AI Predictions button */}
                    <button
                      onClick={handleTriggerPredictions}
                      disabled={predicting}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {predicting
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Cpu className="w-4 h-4" />}
                      {predicting ? "Running AI..." : "Run AI"}
                    </button>
                    <button
                      onClick={() => { setPriceAction("add"); setSelectedPrice(null); setShowPriceModal(true); }}
                      className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      <Plus className="w-4 h-4 mr-1" /> Add Price
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Crop</label>
                    <select value={selectedCrop} onChange={(e) => setSelectedCrop(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                      disabled={loading.crops}>
                      {crops.length === 0
                        ? <option value="">Loading...</option>
                        : crops.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Market</label>
                    <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                      disabled={loading.markets}>
                      {markets.length === 0
                        ? <option value="">Loading...</option>
                        : markets.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Chart */}
                {loading.chart ? (
                  <div className="h-96 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
                  </div>
                ) : chartData.labels.length === 0 ? (
                  <div className="h-96 flex items-center justify-center">
                    <div className="text-center">
                      <Package className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                      <p className="text-gray-400 text-sm">
                        No data for {selectedCrop} in {selectedMarket}
                      </p>
                      <button
                        onClick={() => { setPriceAction("add"); setSelectedPrice(null); setShowPriceModal(true); }}
                        className="mt-4 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                        Add First Price
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-96">
                    <PriceTrendChart
                      labels={chartData.labels}
                      prices={chartData.prices}
                      predictions={chartData.predictions}
                      currentPrice={currentPrice}
                      previousPrice={previousPrice}
                      predictedPrice={predictedPrice}
                      range={chartRange}
                      onRangeChange={setChartRange}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Prices Table */}
            <Card className="mt-6">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Prices</h2>
                  <button onClick={() => window.location.href = "/dashboard/admin/prices"}
                    className="text-sm text-green-600 hover:text-green-700">
                    View all →
                  </button>
                </div>
                {loading.prices ? (
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : recentPrices.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    No prices recorded yet
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead>
                        <tr>
                          {["Crop", "Market", "Price", "Date"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {recentPrices.map((p: any) => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm text-gray-900">{p.crop}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">{p.market}</td>
                            <td className="px-3 py-2 text-sm font-medium text-green-700">
                              ZMW {Number(p.price).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-400">{p.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">

            {/* Recent Activities */}
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activities</h2>
                  <button onClick={fetchActivities}
                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {loading.activities ? (
                  <div className="space-y-4">
                    {Array(5).fill(0).map((_, i) => (
                      <div key={i} className="animate-pulse flex items-start gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4" />
                          <div className="h-3 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No recent activities</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div className="shrink-0">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 leading-snug">
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">
                              {formatDate(activity.timestamp ?? activity.createdAt ?? "")}
                            </span>
                            {activity.user && (
                              <>
                                <span className="text-gray-200">•</span>
                                <span className="text-xs text-gray-400">{activity.user}</span>
                              </>
                            )}
                          </div>
                          {activity.status && (
                            <div className="mt-1">
                              <StatusBadge status={activity.status} size="sm" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => window.location.href = "/dashboard/admin/activities"}
                  className="mt-4 w-full px-4 py-2 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
                  View All Activities
                </button>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card>
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { action: "crops",   icon: Package,      label: "Crops"     },
                    { action: "markets", icon: MapPin,        label: "Markets"   },
                    { action: "prices",  icon: DollarSign,    label: "Add Price" },
                    { action: "users",   icon: Users,         label: "Users"     },
                    { action: "sms",     icon: MessageSquare, label: "SMS"       },
                    { action: "predict", icon: Cpu,           label: predicting ? "Running..." : "Run AI" },
                  ].map(({ action, icon: Icon, label }) => (
                    <button
                      key={action}
                      onClick={() => handleQuickAction(action)}
                      disabled={action === "predict" && predicting}
                      className="p-3 text-center border border-gray-100 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {action === "predict" && predicting
                        ? <Loader2 className="w-5 h-5 text-purple-400 animate-spin mx-auto mb-1.5" />
                        : <Icon className="w-5 h-5 text-gray-400 group-hover:text-green-600 mx-auto mb-1.5" />
                      }
                      <span className="text-xs text-gray-500 group-hover:text-green-700">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Price Modal */}
      {showPriceModal && (
        <PriceManagementModal
          isOpen={showPriceModal}
          onClose={() => setShowPriceModal(false)}
          action={priceAction}
          price={selectedPrice}
          crops={crops}
          markets={markets}
          onSave={async (data) => {
            try {
              if (priceAction === "add") await handleAddPrice(data);
              else if (priceAction === "edit" && selectedPrice) await handleUpdatePrice(selectedPrice.id, data);
              setShowPriceModal(false);
            } catch (err: any) {
              console.error(err);
              setError(err.message || "Failed to save price");
            }
          }}
        />
      )}
    </div>
  );
}