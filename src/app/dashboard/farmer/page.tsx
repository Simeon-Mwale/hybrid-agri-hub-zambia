"use client";

import { useEffect, useState } from "react";
import PriceTrendChart from "@/components/PriceTrendChart";
import { Card } from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import {
  TrendingUp, MapPin, Package, Bell, DollarSign,
  Calendar, ChevronRight, Download, AlertCircle, Loader2,
  LogOut, Settings, History, RefreshCw
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Price {
  id: string;
  cropId: string;
  cropName: string;
  marketId: string;
  marketName: string;
  price: number;
  predictedPrice?: number;
  previousPrice?: number;
  trend: "up" | "down" | "stable";
  lastUpdated: string;
  unit?: string;
}

interface Alert {
  id: string;
  cropId: string;
  cropName: string;
  marketId: string;
  marketName: string;
  targetPrice: number;
  type: "info" | "warning" | "success" | "danger";
  title: string;
  message: string;
  date: string;
  read: boolean;
  actionable?: boolean;
  actionUrl?: string;
}

interface ChartData {
  labels: string[];
  prices: number[];
  predictions: number[];
}

interface FarmerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferredCrops: string[];
  preferredMarkets: string[];
  alertSubscription: boolean;
  role: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// One row from the prices table for chart metric cards
interface ComboPrice {
  price: number;
  predictedPrice?: number;
  previousPrice?: number;
  unit?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FarmerDashboard() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [profile, setProfile] = useState<FarmerProfile | null>(null);

  // ✅ Two separate selectors
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [selectedMarket, setSelectedMarket] = useState<string>("");

  const [chartData, setChartData] = useState<ChartData>({ labels: [], prices: [], predictions: [] });
  const [chartRange, setChartRange] = useState<number>(30);

  const [loading, setLoading] = useState({
    prices: true,
    alerts: true,
    chart: false,
    profile: true,
    subscribe: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── Derived values ───────────────────────────────────────────────────────

  // All unique crops (preferred first if profile loaded)
  const allCrops = [...new Set(prices.map((p) => p.cropName))].sort();
  const preferredCrops = profile?.preferredCrops ?? [];
  const cropOptions = [
    ...allCrops.filter((c) => preferredCrops.includes(c)),
    ...allCrops.filter((c) => !preferredCrops.includes(c)),
  ];

  // Markets available for the selected crop - if no prices, return all markets from profile or empty
  const marketsForCrop = selectedCrop
    ? [...new Set(
        prices.filter((p) => p.cropName === selectedCrop).map((p) => p.marketName)
      )].sort()
    : [];

  // ✅ Prices table: show all markets for the selected crop
  const tablePrices = selectedCrop
    ? prices.filter((p) => p.cropName === selectedCrop)
    : prices;

  // The DB row for the selected crop+market combo (drives metric cards)
  const selectedComboPrice: ComboPrice | null = selectedCrop && selectedMarket
    ? prices.find((p) => p.cropName === selectedCrop && p.marketName === selectedMarket) ?? null
    : null;

  const uniqueMarkets = [...new Set(prices.map((p) => p.marketName))];

  // ─── API helpers ──────────────────────────────────────────────────────────

  const fetchProfile = async (): Promise<FarmerProfile | null> => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) {
        if (res.status === 401) { window.location.href = "/login"; return null; }
        throw new Error("Failed to fetch profile");
      }
      const data: ApiResponse<FarmerProfile> = await res.json();
      return data.success && data.data ? data.data : null;
    } catch (err) {
      console.error("Profile fetch error:", err);
      return null;
    }
  };

  const fetchPrices = async (): Promise<Price[]> => {
    try {
      const res = await fetch("/api/farmer/prices?limit=1000", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to fetch prices");
      const data: ApiResponse<Price[]> = await res.json();
      return data.success ? data.data ?? [] : [];
    } catch (err) {
      console.error("Prices fetch error:", err);
      return [];
    }
  };

  const fetchAlerts = async (): Promise<Alert[]> => {
    try {
      const res = await fetch("/api/farmer/alerts", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to fetch alerts");
      const data: ApiResponse<Alert[]> = await res.json();
      return data.success ? data.data ?? [] : [];
    } catch (err) {
      console.error("Alerts fetch error:", err);
      return [];
    }
  };

  const fetchTrends = async (crop: string, market: string): Promise<ChartData | null> => {
    if (!crop || !market) return null;
    try {
      setLoading((p) => ({ ...p, chart: true }));
      const res = await fetch(
        `/api/farmer/prices/trends?crop=${encodeURIComponent(crop)}&market=${encodeURIComponent(market)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch trends");
      const data: ApiResponse<ChartData> = await res.json();
      if (!data.success || !data.data) return null;
      return data.data;
    } catch (err) {
      console.error("Trends fetch error:", err);
      return null;
    } finally {
      setLoading((p) => ({ ...p, chart: false }));
    }
  };

  // ─── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        setError(null);
        const [profileData, pricesData, alertsData] = await Promise.all([
          fetchProfile(),
          fetchPrices(),
          fetchAlerts(),
        ]);

        if (profileData) {
          setProfile(profileData);
          setLoading((p) => ({ ...p, profile: false }));
        }

        setPrices(pricesData);
        setAlerts(alertsData);
        setLoading((p) => ({ ...p, prices: false, alerts: false }));

        if (pricesData.length > 0) {
          // Default crop: first preferred crop, else first available
          const crops = [...new Set(pricesData.map((p) => p.cropName))].sort();
          const prefCrops = profileData?.preferredCrops ?? [];
          const defaultCrop = crops.find((c) => prefCrops.includes(c)) ?? crops[0] ?? "";

          // Default market: first preferred market for that crop, else first available
          const marketsForDefault = [...new Set(
            pricesData.filter((p) => p.cropName === defaultCrop).map((p) => p.marketName)
          )].sort();
          const prefMarkets = profileData?.preferredMarkets ?? [];
          const defaultMarket = marketsForDefault.find((m) => prefMarkets.includes(m)) ?? marketsForDefault[0] ?? "";

          setSelectedCrop(defaultCrop);
          setSelectedMarket(defaultMarket);

          if (defaultCrop && defaultMarket) {
            const trends = await fetchTrends(defaultCrop, defaultMarket);
            if (trends) setChartData(trends);
          }
        }
      } catch (err) {
        console.error("Init error:", err);
        setError("Failed to load dashboard data. Please try refreshing.");
      }
    };

    init();
  }, []);

  // ─── Re-fetch trends when both crop AND market are selected ───────────────

  useEffect(() => {
    if (!selectedCrop || !selectedMarket) return;
    const load = async () => {
      const trends = await fetchTrends(selectedCrop, selectedMarket);
      setChartData(trends ?? { labels: [], prices: [], predictions: [] });
    };
    load();
  }, [selectedCrop, selectedMarket]);

  // ─── When crop changes, reset market to first available for that crop ─────

  const handleCropChange = (crop: string) => {
    setSelectedCrop(crop);
    const available = [...new Set(
      prices.filter((p) => p.cropName === crop).map((p) => p.marketName)
    )].sort();
    const prefMarkets = profile?.preferredMarkets ?? [];
    const newMarket = available.find((m) => prefMarkets.includes(m)) ?? available[0] ?? "";
    setSelectedMarket(newMarket);
  };

  // ─── Other handlers ───────────────────────────────────────────────────────

  const handleMarkAlertAsRead = async (alertId: string) => {
    try {
      const res = await fetch(`/api/farmer/alerts/${alertId}/read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data: ApiResponse<any> = await res.json();
      if (res.ok && data.success) {
        setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, read: true } : a));
        setSuccessMessage("Alert marked as read");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch {
      setError("Failed to mark alert as read");
    }
  };

  const handleSubscribeToAlerts = async () => {
    if (!profile?.phone) { setError("Please add your phone number in settings first"); return; }
    try {
      setLoading((p) => ({ ...p, subscribe: true }));
      const res = await fetch("/api/farmer/sms/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: profile.phone, subscribe: !profile.alertSubscription }),
      });
      const data: ApiResponse<any> = await res.json();
      if (res.ok && data.success) {
        const updated = await fetchProfile();
        if (updated) setProfile(updated);
        setSuccessMessage(profile.alertSubscription ? "Unsubscribed from SMS alerts" : "Subscribed to SMS alerts!");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch {
      setError("Failed to update subscription");
    } finally {
      setLoading((p) => ({ ...p, subscribe: false }));
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (res.ok) window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleRefresh = async () => {
    setLoading((p) => ({ ...p, prices: true, alerts: true }));
    const [pricesData, alertsData] = await Promise.all([fetchPrices(), fetchAlerts()]);
    setPrices(pricesData);
    setAlerts(alertsData);
    setLoading((p) => ({ ...p, prices: false, alerts: false }));
    if (selectedCrop && selectedMarket) {
      const trends = await fetchTrends(selectedCrop, selectedMarket);
      if (trends) setChartData(trends);
    }
    setSuccessMessage("Data refreshed");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const exportToCSV = () => {
    try {
      const headers = ["Crop", "Market", "Price (ZMW)", "Unit", "Predicted Price", "Last Updated"];
      const rows = tablePrices.map((p) => [
        p.cropName, p.marketName, p.price.toFixed(2),
        p.unit || "50kg bag", p.predictedPrice?.toFixed(2) || "N/A",
        new Date(p.lastUpdated).toLocaleDateString(),
      ]);
      const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prices-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccessMessage("CSV exported");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError("Failed to export CSV");
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === "down") return <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />;
    return <TrendingUp className="w-4 h-4 text-gray-400" />;
  };

  const getPriceChange = (current: number, previous?: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return { percentage: Math.abs(change).toFixed(1), direction: change >= 0 ? "up" : "down" };
  };

  const unreadAlerts = alerts.filter((a) => !a.read).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">

      {/* Header */}
      <div className="bg-white border-b border-green-100 shadow-sm sticky top-0 z-10">
        <div className="px-4 sm:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Welcome back, {profile?.name?.split(" ")[0] || "Farmer"} 👋
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Track prices and get real-time market updates
              </p>
            </div>

            <div className="flex items-center gap-3">
              {successMessage && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in text-sm">
                  {successMessage}
                </div>
              )}

              <div className="relative">
                <Bell className="w-6 h-6 text-gray-600 cursor-pointer hover:text-green-600 transition-colors" />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                    {unreadAlerts}
                  </span>
                )}
              </div>

              <button onClick={handleRefresh} disabled={loading.prices || loading.alerts}
                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50">
                <RefreshCw className={`w-5 h-5 ${loading.prices ? "animate-spin" : ""}`} />
              </button>

              <button onClick={handleSubscribeToAlerts} disabled={loading.subscribe}
                className={`px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50 ${
                  profile?.alertSubscription
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}>
                {loading.subscribe
                  ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  : profile?.alertSubscription ? "SMS Alerts Active" : "Subscribe to SMS"}
              </button>

              <button onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6">

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="flex-1 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {[
            { icon: <Package className="w-5 h-5 text-green-600" />, bg: "bg-green-100", value: loading.prices ? "—" : cropOptions.length, label: "Crops Tracked" },
            { icon: <MapPin className="w-5 h-5 text-blue-600" />, bg: "bg-blue-100", value: loading.prices ? "—" : uniqueMarkets.length, label: "Markets" },
            { icon: <Bell className="w-5 h-5 text-purple-600" />, bg: "bg-purple-100", value: loading.alerts ? "—" : alerts.length, label: "Total Alerts", badge: unreadAlerts > 0 ? `${unreadAlerts} new` : undefined },
            { icon: <Calendar className="w-5 h-5 text-amber-600" />, bg: "bg-amber-100", value: new Date().toLocaleDateString("en-ZM", { day: "numeric", month: "short" }), label: "Last Updated" },
          ].map(({ icon, bg, value, label, badge }) => (
            <Card key={label} className="hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 ${bg} rounded-lg`}>{icon}</div>
                  {badge && <span className="text-xs font-medium text-purple-600">{badge}</span>}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{value}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Tracked Crops Section - Shows all active alerts */}
        {alerts.length > 0 && (
          <Card className="mb-8">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Your Tracked Crops
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    You're tracking {alerts.length} crop{alerts.length !== 1 ? 's' : ''} with price alerts
                  </p>
                </div>
                <a 
                  href="/dashboard/farmer/alerts" 
                  className="text-sm text-green-600 hover:text-green-700 flex items-center"
                >
                  Manage Alerts <ChevronRight className="w-4 h-4 ml-1" />
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {alerts.slice(0, 6).map((alert) => (
                  <div key={alert.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-green-600" />
                        <h3 className="font-semibold text-gray-900">{alert.cropName}</h3>
                      </div>
                      <StatusBadge status={alert.type} size="sm" />
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      📍 {alert.marketName}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Target: ZMW {alert.targetPrice.toFixed(2)}</span>
                      <span className="text-gray-400">Active</span>
                    </div>
                  </div>
                ))}
              </div>
              {alerts.length > 6 && (
                <div className="mt-4 text-center">
                  <a href="/dashboard/farmer/alerts" className="text-sm text-green-600 hover:text-green-700">
                    +{alerts.length - 6} more alerts
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">

            {/* ── Price Chart Card ── */}
            <Card className="overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Price Trends</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Select a crop and market to view the price trend
                    </p>
                  </div>
                  <a href="/dashboard/farmer/prices"
                    className="text-sm text-green-600 hover:text-green-700 flex items-center whitespace-nowrap">
                    View all prices <ChevronRight className="w-4 h-4 ml-1" />
                  </a>
                </div>

                {/* ✅ Two separate dropdowns - Market dropdown always enabled */}
                {loading.prices ? (
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                    <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    {/* Crop dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Crop
                      </label>
                      <select
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                        value={selectedCrop}
                        onChange={(e) => handleCropChange(e.target.value)}
                      >
                        <option value="">Select crop</option>
                        {cropOptions.map((crop) => (
                          <option key={crop} value={crop}>
                            {crop}
                            {preferredCrops.includes(crop) ? " ★" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Market dropdown - Always enabled, shows message when no markets available */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Market
                      </label>
                      <select
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                        value={selectedMarket}
                        onChange={(e) => setSelectedMarket(e.target.value)}
                      >
                        <option value="">
                          {!selectedCrop 
                            ? "Select a crop first" 
                            : marketsForCrop.length === 0 
                              ? "No markets available for this crop" 
                              : "Select market"}
                        </option>
                        {marketsForCrop.map((market) => (
                          <option key={market} value={market}>
                            {market}
                            {profile?.preferredMarkets?.includes(market) ? " ★" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Chart */}
                {loading.chart ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                  </div>
                ) : selectedCrop && selectedMarket && chartData.labels.length > 0 ? (
                  <PriceTrendChart
                    labels={chartData.labels}
                    prices={chartData.prices}
                    predictions={chartData.predictions}
                    currentPrice={selectedComboPrice?.price ?? null}
                    previousPrice={selectedComboPrice?.previousPrice ?? null}
                    predictedPrice={selectedComboPrice?.predictedPrice ?? null}
                    range={chartRange}
                    onRangeChange={setChartRange}
                  />
                ) : selectedCrop && selectedMarket ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <DollarSign className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No trend data for {selectedCrop} in {selectedMarket}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        {!selectedCrop ? "Select a crop to get started" : "Now select a market"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* ── Prices Table ── */}
            <Card className="overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                      {selectedCrop ? `${selectedCrop} — All Markets` : "Current Market Prices"}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedCrop
                        ? `Showing ${selectedCrop} prices across all ${tablePrices.length} market${tablePrices.length !== 1 ? "s" : ""}`
                        : "Select a crop above to filter by crop"}
                    </p>
                  </div>
                  <button onClick={exportToCSV} disabled={tablePrices.length === 0}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                </div>

                {loading.prices ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />
                    ))}
                  </div>
                ) : tablePrices.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">No price data available</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {(selectedCrop
                            ? ["Market", "Price", "Prediction", "Change", "Updated"]
                            : ["Crop", "Market", "Price", "Prediction", "Change", "Updated"]
                          ).map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tablePrices.map((price) => {
                          const change = getPriceChange(price.price, price.previousPrice);
                          const isChartMarket = price.marketName === selectedMarket;
                          return (
                            <tr
                              key={price.id}
                              onClick={() => setSelectedMarket(price.marketName)}
                              className={`cursor-pointer transition-colors ${
                                isChartMarket
                                  ? "bg-green-50 ring-1 ring-inset ring-green-200"
                                  : "hover:bg-green-50"
                              }`}
                              title="Click to view trend for this market"
                            >
                              {!selectedCrop && (
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-900">{price.cropName}</span>
                                  </div>
                                </td>
                              )}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-700">{price.marketName}</span>
                                  {isChartMarket && (
                                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">charted</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm font-semibold text-green-700">ZMW {price.price.toFixed(2)}</span>
                                {price.unit && <span className="text-xs text-gray-400 ml-1">/{price.unit}</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {price.predictedPrice
                                  ? <span className="text-sm text-amber-600">ZMW {price.predictedPrice.toFixed(2)}</span>
                                  : <span className="text-sm text-gray-400">—</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {change ? (
                                  <div className={`flex items-center gap-1 ${change.direction === "up" ? "text-green-600" : "text-red-600"}`}>
                                    {getTrendIcon(change.direction)}
                                    <span className="text-xs font-medium">{change.percentage}%</span>
                                  </div>
                                ) : <span className="text-sm text-gray-400">—</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(price.lastUpdated).toLocaleDateString("en-ZM")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-1 space-y-6">

            {/* Alerts */}
            <Card className="overflow-hidden">
              <div className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  Recent Alerts
                  {unreadAlerts > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{unreadAlerts} new</span>
                  )}
                </h2>

                {loading.alerts ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4" />
                          <div className="h-3 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-1">No alerts yet</p>
                    <p className="text-xs text-gray-400">Subscribe to get price alerts</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.slice(0, 5).map((alert) => (
                      <div key={alert.id}
                        onClick={() => !alert.read && handleMarkAlertAsRead(alert.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          alert.read
                            ? "bg-gray-50 border-gray-100 opacity-70"
                            : "bg-white border-green-100 shadow-sm hover:shadow-md"
                        }`}>
                        <div className="flex items-start justify-between mb-1.5">
                          <StatusBadge status={alert.type} size="sm" />
                          {!alert.read && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mt-1" />}
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 mb-0.5">{alert.title}</h4>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{alert.message}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">{new Date(alert.date).toLocaleDateString("en-ZM")}</span>
                          {alert.actionable && (
                            <a href={alert.actionUrl || "#"} onClick={(e) => e.stopPropagation()}
                              className="text-xs text-green-600 hover:text-green-700">View</a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {alerts.length > 5 && (
                  <a href="/dashboard/farmer/alerts"
                    className="mt-4 block w-full text-center px-4 py-2 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
                    View All Alerts ({alerts.length})
                  </a>
                )}
              </div>
            </Card>

            {/* Market Insight */}
            <Card className="bg-gradient-to-br from-green-600 to-emerald-600 text-white">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-3">💰 Market Insight</h3>
                <p className="text-sm text-green-100 mb-4">
                  Based on current trends, maize prices are showing positive momentum.
                  Consider monitoring your preferred markets for the best prices.
                </p>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-green-200">Best time to sell:</span>
                    <span className="font-semibold">Next 2 weeks</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-green-200">Avg. price range:</span>
                    <span className="font-semibold">ZMW 180 – 220</span>
                  </div>
                </div>
                <a href="/dashboard/farmer/insights"
                  className="block w-full text-center text-sm text-white border border-white/30 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors">
                  View Detailed Analysis
                </a>
              </div>
            </Card>

            {/* Quick Links */}
            <Card>
              <div className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
                <div className="space-y-1">
                  {[
                    { href: "/dashboard/farmer/settings", icon: Settings, label: "Settings" },
                    { href: "/dashboard/farmer/history", icon: History, label: "Price History" },
                    { href: "/dashboard/farmer/preferences", icon: Package, label: "Crop Preferences" },
                  ].map(({ href, icon: Icon, label }) => (
                    <a key={href} href={href}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </a>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}