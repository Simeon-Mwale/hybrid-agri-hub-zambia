"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import {
  Package, MapPin, Save, Loader2, CheckCircle,
  AlertCircle, RefreshCw, Check, X, DollarSign,
  Bell, Plus, Trash2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Crop {
  id: string;
  name: string;
  category: string | null;
  unit: string;
}

interface Market {
  id: string;
  name: string;
  province: string;
  district: string | null;
}

interface PriceAlert {
  id?: string;
  cropId: string;
  cropName: string;
  marketId: string;
  marketName: string;
  targetPrice: number;
  isActive: boolean;
}

interface PreferencesData {
  preferredCrops: string[];
  preferredMarkets: string[];
  allCrops: Crop[];
  allMarkets: Market[];
  priceAlerts: PriceAlert[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ChipProps {
  label: string;
  sublabel?: string;
  selected: boolean;
  onToggle: () => void;
}

function Chip({ label, sublabel, selected, onToggle }: ChipProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-left transition-all ${
        selected
          ? "bg-green-50 border-green-400 ring-1 ring-green-300"
          : "bg-white border-gray-200 hover:border-green-300 hover:bg-green-50/40"
      }`}
    >
      <div className="min-w-0">
        <p className={`text-sm font-medium truncate ${selected ? "text-green-800" : "text-gray-800"}`}>
          {label}
        </p>
        {sublabel && (
          <p className={`text-xs mt-0.5 truncate ${selected ? "text-green-600" : "text-gray-500"}`}>
            {sublabel}
          </p>
        )}
      </div>
      <span className={`ml-3 shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
        selected
          ? "bg-green-500 border-green-500"
          : "border-gray-300"
      }`}>
        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

export default function PreferencesPage() {
  const [data, setData] = useState<PreferencesData | null>(null);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);

  const [cropSearch, setCropSearch] = useState("");
  const [marketSearch, setMarketSearch] = useState("");
  
  // Alert form state
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertCropId, setAlertCropId] = useState("");
  const [alertCropName, setAlertCropName] = useState("");
  const [alertMarketId, setAlertMarketId] = useState("");
  const [alertMarketName, setAlertMarketName] = useState("");
  const [alertTargetPrice, setAlertTargetPrice] = useState<number>(0);

  const [loading, setLoading] = useState({ page: true, save: false, alert: false });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPreferences = async () => {
    try {
      setLoading((p) => ({ ...p, page: true }));
      setError(null);
      const res = await fetch("/api/farmer/preferences", { credentials: "include" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error("Failed to load preferences");
      const json: ApiResponse<PreferencesData> = await res.json();
      if (!json.success || !json.data) throw new Error(json.error ?? "Invalid response");
      setData(json.data);
      setSelectedCrops(json.data.preferredCrops);
      setSelectedMarkets(json.data.preferredMarkets);
      setPriceAlerts(json.data.priceAlerts || []);
      setIsDirty(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to load preferences");
    } finally {
      setLoading((p) => ({ ...p, page: false }));
    }
  };

  useEffect(() => { fetchPreferences(); }, []);

  // ─── Toggle helpers ─────────────────────────────────────────────────────────

  const toggleCrop = (name: string) => {
    setSelectedCrops((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
    setIsDirty(true);
  };

  const toggleMarket = (name: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
    setIsDirty(true);
  };

  const selectAllCrops = () => {
    setSelectedCrops(filteredCrops.map((c) => c.name));
    setIsDirty(true);
  };

  const clearAllCrops = () => {
    setSelectedCrops([]);
    setIsDirty(true);
  };

  const selectAllMarkets = () => {
    setSelectedMarkets(filteredMarkets.map((m) => m.name));
    setIsDirty(true);
  };

  const clearAllMarkets = () => {
    setSelectedMarkets([]);
    setIsDirty(true);
  };

  // ─── Price Alert Handlers ───────────────────────────────────────────────────

  const handleAddAlert = async () => {
    if (!alertCropId || !alertMarketId || alertTargetPrice <= 0) {
      setError("Please select crop, market and enter a valid target price");
      return;
    }

    try {
      setLoading((p) => ({ ...p, alert: true }));
      const res = await fetch("/api/farmer/alerts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropId: alertCropId,
          marketId: alertMarketId,
          targetPrice: alertTargetPrice,
        }),
      });
      
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create alert");
      }

      setSuccess(`Price alert created for ${alertCropName} at ${alertMarketName} when price reaches ZMW ${alertTargetPrice}`);
      setShowAlertForm(false);
      setAlertCropId("");
      setAlertCropName("");
      setAlertMarketId("");
      setAlertMarketName("");
      setAlertTargetPrice(0);
      
      // Refresh alerts
      await fetchPreferences();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading((p) => ({ ...p, alert: false }));
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/farmer/alerts/${alertId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete alert");
      }

      setSuccess("Alert deleted successfully");
      await fetchPreferences();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ─── Save Preferences ───────────────────────────────────────────────────────

  const handleSave = async () => {
    try {
      setLoading((p) => ({ ...p, save: true }));
      setError(null);
      const res = await fetch("/api/farmer/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredCrops: selectedCrops,
          preferredMarkets: selectedMarkets,
        }),
      });
      const json: ApiResponse<any> = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to save preferences");
        return;
      }
      setSuccess("Preferences saved! Your dashboard will now show personalised data.");
      setIsDirty(false);
      setTimeout(() => setSuccess(null), 5000);
    } catch {
      setError("Failed to save preferences. Please try again.");
    } finally {
      setLoading((p) => ({ ...p, save: false }));
    }
  };

  // ─── Filtered lists ─────────────────────────────────────────────────────────

  const filteredCrops = (data?.allCrops ?? []).filter((c) =>
    c.name.toLowerCase().includes(cropSearch.toLowerCase()) ||
    (c.category ?? "").toLowerCase().includes(cropSearch.toLowerCase())
  );

  const filteredMarkets = (data?.allMarkets ?? []).filter((m) =>
    m.name.toLowerCase().includes(marketSearch.toLowerCase()) ||
    m.province.toLowerCase().includes(marketSearch.toLowerCase())
  );

  const marketsByProvince = filteredMarkets.reduce<Record<string, Market[]>>((acc, m) => {
    if (!acc[m.province]) acc[m.province] = [];
    acc[m.province].push(m);
    return acc;
  }, {});

  const cropsByCategory = filteredCrops.reduce<Record<string, Crop[]>>((acc, c) => {
    const cat = c.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  // ─── Loading skeleton ────────────────────────────────────────────────────────

  if (loading.page) {
    return (
      <div className="p-6 sm:p-8 min-h-screen bg-green-50">
        <div className="h-8 bg-gray-200 rounded w-56 mb-3 animate-pulse" />
        <div className="h-4 bg-gray-100 rounded w-80 mb-8 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-green-50">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Crop Preferences & Alerts</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Choose crops and markets you care about, and set price alerts to get notified when prices hit your target amount.
          </p>
        </div>
        <button
          onClick={fetchPreferences}
          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm">
          <Package className="w-4 h-4 text-green-600" />
          <span className="text-gray-700">
            <span className="font-semibold text-green-700">{selectedCrops.length}</span>
            {" "}of {data?.allCrops.length ?? 0} crops selected
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-gray-700">
            <span className="font-semibold text-blue-700">{selectedMarkets.length}</span>
            {" "}of {data?.allMarkets.length ?? 0} markets selected
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm">
          <Bell className="w-4 h-4 text-purple-600" />
          <span className="text-gray-700">
            <span className="font-semibold text-purple-700">{priceAlerts.length}</span>
            {" "}active price alerts
          </span>
        </div>
        {isDirty && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            Unsaved changes
          </div>
        )}
      </div>

      {/* Toasts */}
      {error && (
        <div className="mb-5 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Price Alerts Section */}
      <Card className="mb-6 overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <Bell className="w-4 h-4 text-purple-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Price Alerts</h2>
            </div>
            <button
              onClick={() => setShowAlertForm(!showAlertForm)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Set Target Amount
            </button>
          </div>

          {/* Add Alert Form */}
          {showAlertForm && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <h3 className="font-medium text-gray-900 mb-3">Set Your Target Price Alert</h3>
              <p className="text-xs text-gray-600 mb-4">
                You'll receive a notification when the price reaches or exceeds your target amount
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Crop</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    value={alertCropId}
                    onChange={(e) => {
                      const crop = data?.allCrops.find(c => c.id === e.target.value);
                      setAlertCropId(e.target.value);
                      setAlertCropName(crop?.name || "");
                    }}
                  >
                    <option value="">Select crop</option>
                    {data?.allCrops.map(crop => (
                      <option key={crop.id} value={crop.id}>{crop.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Market</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    value={alertMarketId}
                    onChange={(e) => {
                      const market = data?.allMarkets.find(m => m.id === e.target.value);
                      setAlertMarketId(e.target.value);
                      setAlertMarketName(market?.name || "");
                    }}
                  >
                    <option value="">Select market</option>
                    {data?.allMarkets.map(market => (
                      <option key={market.id} value={market.id}>{market.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Target Amount (ZMW)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                      placeholder="e.g., 299"
                      value={alertTargetPrice}
                      onChange={(e) => setAlertTargetPrice(parseFloat(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Alert when price reaches ZMW {alertTargetPrice || "____"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddAlert}
                  disabled={loading.alert}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {loading.alert ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Alert"}
                </button>
                <button
                  onClick={() => setShowAlertForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Active Alerts List */}
          {priceAlerts.length > 0 ? (
            <div className="space-y-2">
              {priceAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <DollarSign className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {alert.cropName} at {alert.marketName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Alert when price reaches <span className="font-semibold text-green-600">ZMW {alert.targetPrice}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => alert.id && handleDeleteAlert(alert.id)}
                    className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    title="Delete alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No price alerts set</p>
              <p className="text-xs text-gray-400">Click "Set Target Amount" to create an alert for your desired price</p>
            </div>
          )}
        </div>
      </Card>

      {/* Two-column grid for preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* ── Crops ── */}
        <Card className="overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <Package className="w-4 h-4 text-green-600" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Select Crops to Track</h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button onClick={selectAllCrops} className="text-green-600 hover:text-green-800 hover:underline">
                  Select all
                </button>
                <span className="text-gray-300">|</span>
                <button onClick={clearAllCrops} className="text-gray-500 hover:text-gray-700 hover:underline">
                  Clear
                </button>
              </div>
            </div>

            <input
              type="text"
              value={cropSearch}
              onChange={(e) => setCropSearch(e.target.value)}
              placeholder="Search crops..."
              className="w-full px-3 py-2 mb-4 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />

            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {Object.keys(cropsByCategory).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No crops found</p>
              ) : (
                Object.entries(cropsByCategory).map(([category, crops]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {category}
                    </p>
                    <div className="space-y-2">
                      {crops.map((crop) => (
                        <Chip
                          key={crop.id}
                          label={crop.name}
                          sublabel={`per ${crop.unit}`}
                          selected={selectedCrops.includes(crop.name)}
                          onToggle={() => toggleCrop(crop.name)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* ── Markets ── */}
        <Card className="overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Select Markets to Track</h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button onClick={selectAllMarkets} className="text-blue-600 hover:text-blue-800 hover:underline">
                  Select all
                </button>
                <span className="text-gray-300">|</span>
                <button onClick={clearAllMarkets} className="text-gray-500 hover:text-gray-700 hover:underline">
                  Clear
                </button>
              </div>
            </div>

            <input
              type="text"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              placeholder="Search markets or provinces..."
              className="w-full px-3 py-2 mb-4 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />

            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {Object.keys(marketsByProvince).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No markets found</p>
              ) : (
                Object.entries(marketsByProvince).sort().map(([province, markets]) => (
                  <div key={province}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {province}
                    </p>
                    <div className="space-y-2">
                      {markets.map((market) => (
                        <Chip
                          key={market.id}
                          label={market.name}
                          sublabel={market.district ?? market.province}
                          selected={selectedMarkets.includes(market.name)}
                          onToggle={() => toggleMarket(market.name)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Preview of what will be tracked */}
      {selectedCrops.length > 0 && selectedMarkets.length > 0 && (
        <Card className="mb-8 overflow-hidden">
          <div className="p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Preview — {selectedCrops.length * selectedMarkets.length} crop-market pairs will be tracked
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedCrops.slice(0, 3).flatMap((crop) =>
                selectedMarkets.slice(0, 3).map((market) => (
                  <span key={`${crop}-${market}`}
                    className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full">
                    {crop} · {market}
                  </span>
                ))
              )}
              {selectedCrops.length * selectedMarkets.length > 9 && (
                <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full">
                  +{selectedCrops.length * selectedMarkets.length - 9} more
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* No selection warning */}
      {(selectedCrops.length === 0 || selectedMarkets.length === 0) && !loading.page && (
        <div className="mb-8 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            {selectedCrops.length === 0 && selectedMarkets.length === 0
              ? "Please select at least one crop and one market to personalise your dashboard."
              : selectedCrops.length === 0
              ? "Please select at least one crop to start tracking prices."
              : "Please select at least one market to start tracking prices."}
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={loading.save || !isDirty || selectedCrops.length === 0 || selectedMarkets.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading.save
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            : <><Save className="w-4 h-4" /> Save preferences</>}
        </button>
        {isDirty && (
          <button
            onClick={fetchPreferences}
            className="flex items-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-900 text-sm transition-colors"
          >
            <X className="w-4 h-4" /> Discard changes
          </button>
        )}
      </div>
    </div>
  );
}