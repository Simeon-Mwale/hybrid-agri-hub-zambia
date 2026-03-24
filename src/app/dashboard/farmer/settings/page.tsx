"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import {
  User, Bell, Moon, Sun, Phone, Mail, Lock, Save,
  Loader2, AlertCircle, CheckCircle, Trash2, Plus,
  ChevronDown, ChevronUp, Eye, EyeOff, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceAlert {
  id: string;
  cropId: string;
  marketId: string;
  targetPrice: number;
  isActive: boolean;
  crop: { name: string; unit: string };
  market: { name: string; province: string };
}

interface UserSettings {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
  priceAlerts: PriceAlert[];
}

interface Crop { id: string; name: string; unit: string }
interface Market { id: string; name: string; province: string }

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Section accordion — defined OUTSIDE the page component ──────────────────
// ✅ This is the critical fix. When Section was defined inside the page component,
// React treated it as a new component type on every render, which caused it to
// unmount and remount the inputs on every keystroke, resetting focus each time.
interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

function Section({ id, icon, title, subtitle, expanded, onToggle, children }: SectionProps) {
  return (
    <Card className="overflow-hidden dark:bg-gray-800">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">{icon}</div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{title}</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
      </button>
      {expanded && (
        <div className="px-5 sm:px-6 pb-6 border-t border-gray-100 dark:border-gray-700 pt-5">
          {children}
        </div>
      )}
    </Card>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);

  // Profile form — own state, never touched by re-renders from other state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // New alert form
  const [newAlertCropId, setNewAlertCropId] = useState("");
  const [newAlertMarketId, setNewAlertMarketId] = useState("");
  const [newAlertPrice, setNewAlertPrice] = useState("");

  // UI
  const [darkMode, setDarkMode] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("profile");
  const [loading, setLoading] = useState({
    page: true, profile: false, password: false, alert: false, deleteAlert: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const toggleSection = (key: string) =>
    setExpandedSection((prev) => (prev === key ? null : key));

  // ─── Dark mode ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    setDarkMode(isDark);
  };

  // ─── Fetch settings + crops + markets ──────────────────────────────────────

  const fetchSettings = async () => {
    try {
      setLoading((p) => ({ ...p, page: true }));
      const [settingsRes, cropsRes, marketsRes] = await Promise.all([
        fetch("/api/farmer/settings", { credentials: "include" }),
        fetch("/api/farmer/crops", { credentials: "include" }),
        fetch("/api/farmer/markets", { credentials: "include" }),
      ]);

      if (settingsRes.status === 401) { window.location.href = "/login"; return; }

      const settingsData: ApiResponse<UserSettings> = await settingsRes.json();
      const cropsData: ApiResponse<Crop[]> = await cropsRes.json();
      const marketsData: ApiResponse<Market[]> = await marketsRes.json();

      if (settingsData.success && settingsData.data) {
        setSettings(settingsData.data);
        // ✅ Only set form state on initial load, never again
        setFullName(settingsData.data.fullName);
        setPhone(settingsData.data.phone ?? "");
      }
      if (cropsData.success && cropsData.data) setCrops(cropsData.data);
      if (marketsData.success && marketsData.data) setMarkets(marketsData.data);
    } catch {
      showError("Failed to load settings. Please refresh.");
    } finally {
      setLoading((p) => ({ ...p, page: false }));
    }
  };

  useEffect(() => { fetchSettings(); }, []); // ✅ runs once only

  // ─── Save profile ───────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!fullName.trim()) { showError("Full name cannot be empty"); return; }
    try {
      setLoading((p) => ({ ...p, profile: true }));
      const res = await fetch("/api/farmer/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim() }),
      });
      const data: ApiResponse<UserSettings> = await res.json();
      if (!res.ok || !data.success) { showError(data.error ?? "Failed to save profile"); return; }
      // Update settings display without touching fullName/phone form state
      setSettings((prev) =>
        prev ? { ...prev, fullName: fullName.trim(), phone: phone.trim() || null } : prev
      );
      showSuccess("Profile updated successfully");
    } catch {
      showError("Failed to save profile");
    } finally {
      setLoading((p) => ({ ...p, profile: false }));
    }
  };

  // ─── Change password ────────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    if (!currentPassword) { showError("Please enter your current password"); return; }
    if (newPassword.length < 8) { showError("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { showError("New passwords do not match"); return; }
    try {
      setLoading((p) => ({ ...p, password: true }));
      const res = await fetch("/api/farmer/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data: ApiResponse<any> = await res.json();
      if (!res.ok || !data.success) { showError(data.error ?? "Failed to change password"); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      showSuccess("Password changed successfully");
    } catch {
      showError("Failed to change password");
    } finally {
      setLoading((p) => ({ ...p, password: false }));
    }
  };

  // ─── Add price alert ────────────────────────────────────────────────────────

  const handleAddAlert = async () => {
    if (!newAlertCropId || !newAlertMarketId || !newAlertPrice) {
      showError("Please fill in all alert fields"); return;
    }
    const price = parseFloat(newAlertPrice);
    if (isNaN(price) || price <= 0) { showError("Please enter a valid target price"); return; }
    try {
      setLoading((p) => ({ ...p, alert: true }));
      const res = await fetch("/api/farmer/settings/alerts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropId: newAlertCropId, marketId: newAlertMarketId, targetPrice: price }),
      });
      const data: ApiResponse<PriceAlert> = await res.json();
      if (!res.ok || !data.success) { showError(data.error ?? "Failed to add alert"); return; }
      if (data.data) {
        setSettings((prev) =>
          prev
            ? { ...prev, priceAlerts: [data.data!, ...prev.priceAlerts.filter((a) => a.id !== data.data!.id)] }
            : prev
        );
      }
      setNewAlertCropId(""); setNewAlertMarketId(""); setNewAlertPrice("");
      showSuccess("Price alert added");
    } catch {
      showError("Failed to add alert");
    } finally {
      setLoading((p) => ({ ...p, alert: false }));
    }
  };

  // ─── Delete price alert ─────────────────────────────────────────────────────

  const handleDeleteAlert = async (alertId: string) => {
    try {
      setLoading((p) => ({ ...p, deleteAlert: alertId }));
      const res = await fetch("/api/farmer/settings/alerts", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      const data: ApiResponse<any> = await res.json();
      if (!res.ok || !data.success) { showError(data.error ?? "Failed to remove alert"); return; }
      setSettings((prev) =>
        prev ? { ...prev, priceAlerts: prev.priceAlerts.filter((a) => a.id !== alertId) } : prev
      );
      showSuccess("Alert removed");
    } catch {
      showError("Failed to remove alert");
    } finally {
      setLoading((p) => ({ ...p, deleteAlert: "" }));
    }
  };

  // ─── Loading skeleton ───────────────────────────────────────────────────────

  if (loading.page) {
    return (
      <div className="min-h-screen bg-green-50 dark:bg-gray-900 p-6 sm:p-8">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-3 animate-pulse" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-64 mb-8 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-green-50 dark:bg-gray-900 p-6 sm:p-8 transition-colors">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your account, alerts, and preferences
          </p>
        </div>
        <button
          onClick={fetchSettings}
          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Account summary pill */}
      {settings && (
        <div className="flex items-center gap-3 mb-6 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {settings.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{settings.fullName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{settings.email}</p>
          </div>
          <span className="ml-auto text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full capitalize flex-shrink-0">
            {settings.role.toLowerCase()}
          </span>
        </div>
      )}

      {/* Toasts */}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="space-y-4">

        {/* ── Profile ── */}
        <Section
          id="profile"
          icon={<User className="w-5 h-5 text-green-600 dark:text-green-400" />}
          title="Profile"
          subtitle="Update your name and phone number"
          expanded={expandedSection === "profile"}
          onToggle={toggleSection}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={settings?.email ?? ""}
                  readOnly
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact support.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Phone number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+260 9X XXX XXXX"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Used for SMS price alerts.</p>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={loading.profile}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading.profile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </Section>

        {/* ── Password ── */}
        <Section
          id="password"
          icon={<Lock className="w-5 h-5 text-green-600 dark:text-green-400" />}
          title="Password"
          subtitle="Change your account password"
          expanded={expandedSection === "password"}
          onToggle={toggleSection}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Current password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full pr-10 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pr-10 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="mt-1.5 flex gap-1">
                  {[4, 6, 8, 10].map((len) => (
                    <div key={len} className={`h-1 flex-1 rounded-full transition-colors ${
                      newPassword.length >= len ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"
                    }`} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className={`w-full px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  confirmPassword && confirmPassword !== newPassword
                    ? "border-red-400 dark:border-red-500"
                    : "border-gray-200 dark:border-gray-600"
                }`}
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
              )}
            </div>

            <button
              onClick={handleChangePassword}
              disabled={loading.password || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading.password ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Change password
            </button>
          </div>
        </Section>

        {/* ── Price Alerts ── */}
        <Section
          id="alerts"
          icon={<Bell className="w-5 h-5 text-green-600 dark:text-green-400" />}
          title="Price Alerts"
          subtitle={`${settings?.priceAlerts.length ?? 0} alert${settings?.priceAlerts.length !== 1 ? "s" : ""} active`}
          expanded={expandedSection === "alerts"}
          onToggle={toggleSection}
        >
          <div className="space-y-5">
            {settings?.priceAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                No price alerts set. Add one below to get notified by SMS.
              </p>
            ) : (
              <div className="space-y-2">
                {settings?.priceAlerts.map((alert) => (
                  <div key={alert.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {alert.crop.name} — {alert.market.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Alert when price reaches{" "}
                        <span className="font-medium text-green-600 dark:text-green-400">
                          ZMW {alert.targetPrice.toFixed(2)}
                        </span>
                        {" "}/ {alert.crop.unit}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      disabled={loading.deleteAlert === alert.id}
                      className="ml-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {loading.deleteAlert === alert.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add new alert</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <select
                  value={newAlertCropId}
                  onChange={(e) => setNewAlertCropId(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select crop</option>
                  {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <select
                  value={newAlertMarketId}
                  onChange={(e) => setNewAlertMarketId(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select market</option>
                  {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newAlertPrice}
                  onChange={(e) => setNewAlertPrice(e.target.value)}
                  placeholder="Target price (ZMW)"
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleAddAlert}
                disabled={loading.alert || !newAlertCropId || !newAlertMarketId || !newAlertPrice}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading.alert ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add alert
              </button>
            </div>
          </div>
        </Section>

        {/* ── Appearance ── */}
        <Section
          id="appearance"
          icon={darkMode
            ? <Moon className="w-5 h-5 text-green-600 dark:text-green-400" />
            : <Sun className="w-5 h-5 text-green-600" />}
          title="Appearance"
          subtitle={darkMode ? "Dark mode is on" : "Light mode is on"}
          expanded={expandedSection === "appearance"}
          onToggle={toggleSection}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {darkMode ? "Switch to light mode" : "Switch to dark mode"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Your preference is saved locally</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                darkMode ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                darkMode ? "translate-x-6" : "translate-x-0"
              }`} />
            </button>
          </div>
        </Section>

        {/* ── Account info ── */}
        {settings && (
          <Card className="p-5 sm:p-6 dark:bg-gray-800">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
              Account info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Member since</span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(settings.createdAt).toLocaleDateString("en-ZM", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Account role</span>
                <span className="text-gray-900 dark:text-white capitalize">{settings.role.toLowerCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Active price alerts</span>
                <span className="text-gray-900 dark:text-white">{settings.priceAlerts.length}</span>
              </div>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}