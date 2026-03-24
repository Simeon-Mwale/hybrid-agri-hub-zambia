"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import { 
  Bell, 
  Search, 
  Filter, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Users,
  Package,
  MapPin,
  DollarSign,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle
} from "lucide-react";

interface Alert {
  id: string;
  userId: string;
  cropId: string;
  marketId: string;
  targetPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  crop?: {
    id: string;
    name: string;
    category: string;
  };
  market?: {
    id: string;
    name: string;
    province: string;
  };
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

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
  page?: number;
  limit?: number;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState({
    alerts: true,
    crops: true,
    markets: true,
    users: true
  });
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterCrop, setFilterCrop] = useState<string>("");
  const [filterMarket, setFilterMarket] = useState<string>("");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Fetch alerts when filters change
  useEffect(() => {
    fetchAlerts();
  }, [currentPage, filterStatus, filterCrop, filterMarket, searchTerm]);

  const fetchAllData = async () => {
    try {
      setError(null);
      await Promise.all([
        fetchAlerts(),
        fetchCrops(),
        fetchMarkets(),
        fetchUsers()
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load some data. Please try refreshing the page.");
    }
  };

  const fetchAlerts = async () => {
    try {
      setLoading(prev => ({ ...prev, alerts: true }));
      
      // Build query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });
      
      if (filterStatus !== "all") {
        params.append('isActive', (filterStatus === "active").toString());
      }
      if (filterCrop) params.append('cropId', filterCrop);
      if (filterMarket) params.append('marketId', filterMarket);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch(`/api/admin/alerts?${params.toString()}`, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error(`Failed to fetch alerts: ${response.statusText}`);
      }

      const result: ApiResponse<Alert[]> = await response.json();
      
      if (result.success) {
        setAlerts(result.data || []);
        setTotalItems(result.total || result.data?.length || 0);
        setTotalPages(Math.ceil((result.total || result.data?.length || 0) / itemsPerPage));
      } else {
        throw new Error(result.message || 'Failed to fetch alerts');
      }
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(prev => ({ ...prev, alerts: false }));
    }
  };

  const fetchCrops = async () => {
    try {
      const response = await fetch("/api/admin/crops?limit=100", { 
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result: ApiResponse<Crop[]> = await response.json();
        setCrops(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching crops:", err);
    } finally {
      setLoading(prev => ({ ...prev, crops: false }));
    }
  };

  const fetchMarkets = async () => {
    try {
      const response = await fetch("/api/admin/markets?limit=100", { 
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result: ApiResponse<Market[]> = await response.json();
        setMarkets(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching markets:", err);
    } finally {
      setLoading(prev => ({ ...prev, markets: false }));
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users?limit=100", { 
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result: ApiResponse<User[]> = await response.json();
        setUsers(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(prev => ({ ...prev, users: false }));
    }
  };

  // Toggle alert status
  const toggleAlertStatus = async (alert: Alert) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json" 
        },
        credentials: "include",
        body: JSON.stringify({ isActive: !alert.isActive })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error("Failed to update alert status");
      }

      const result: ApiResponse<Alert> = await response.json();
      
      if (result.success) {
        // Update local state
        setAlerts(prev => prev.map(a => 
          a.id === alert.id ? { ...a, isActive: !a.isActive } : a
        ));
      } else {
        throw new Error(result.message || 'Failed to update alert');
      }
    } catch (err) {
      console.error("Error toggling alert:", err);
      setError(err instanceof Error ? err.message : "Failed to update alert status");
    }
  };

  // Delete alert
  const deleteAlert = async (id: string) => {
    if (!confirm("Are you sure you want to delete this alert?")) return;
    
    try {
      const response = await fetch(`/api/admin/alerts/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error("Failed to delete alert");
      }

      const result: ApiResponse<null> = await response.json();
      
      if (result.success) {
        // Remove from local state
        setAlerts(prev => prev.filter(a => a.id !== id));
        setTotalItems(prev => prev - 1);
        
        // Adjust current page if needed
        if (alerts.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
        } else {
          // Refresh to get updated data
          fetchAlerts();
        }
      } else {
        throw new Error(result.message || 'Failed to delete alert');
      }
    } catch (err) {
      console.error("Error deleting alert:", err);
      setError(err instanceof Error ? err.message : "Failed to delete alert");
    }
  };

  // Get user details
  const getUserDetails = (userId: string) => {
    return users.find(u => u.id === userId);
  };

  // Get crop details
  const getCropDetails = (cropId: string) => {
    return crops.find(c => c.id === cropId);
  };

  // Get market details
  const getMarketDetails = (marketId: string) => {
    return markets.find(m => m.id === marketId);
  };

  // Handle search with debounce
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on new search
  };

  // Handle filter change
  const handleFilterChange = (type: string, value: string) => {
    switch(type) {
      case 'status':
        setFilterStatus(value as any);
        break;
      case 'crop':
        setFilterCrop(value);
        break;
      case 'market':
        setFilterMarket(value);
        break;
    }
    setCurrentPage(1); // Reset to first page on filter change
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterCrop("");
    setFilterMarket("");
    setCurrentPage(1);
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-ZM', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || filterStatus !== "all" || filterCrop || filterMarket;

  // Statistics
  const totalActiveAlerts = alerts.filter(a => a.isActive).length;
  const totalInactiveAlerts = alerts.filter(a => !a.isActive).length;
  const isLoading = loading.alerts || loading.crops || loading.markets || loading.users;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Price Alerts Management</h1>
          <p className="text-gray-600 mt-1">Monitor and manage user price alerts across all crops and markets</p>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-red-700 hover:text-red-900"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                  <Bell className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-gray-900">{totalItems}</span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">Total Alerts</h3>
            </div>
          </Card>
          
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-green-100 text-green-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-green-600">{totalActiveAlerts}</span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">Active Alerts</h3>
            </div>
          </Card>
          
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-gray-100 text-gray-600">
                  <XCircle className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-gray-500">{totalInactiveAlerts}</span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">Inactive Alerts</h3>
            </div>
          </Card>
          
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-gray-900">{users.length}</span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
            </div>
          </Card>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by user, crop, market, or price..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Crop Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Crop
              </label>
              <select
                value={filterCrop}
                onChange={(e) => handleFilterChange('crop', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={loading.crops}
              >
                <option value="">All Crops</option>
                {crops.map(crop => (
                  <option key={crop.id} value={crop.id}>{crop.name}</option>
                ))}
              </select>
            </div>

            {/* Market Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Market
              </label>
              <select
                value={filterMarket}
                onChange={(e) => handleFilterChange('market', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={loading.markets}
              >
                <option value="">All Markets</option>
                {markets.map(market => (
                  <option key={market.id} value={market.id}>{market.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">Active filters:</span>
                {searchTerm && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center">
                    Search: {searchTerm}
                    <button onClick={() => handleSearch("")} className="ml-1 hover:text-blue-900">×</button>
                  </span>
                )}
                {filterStatus !== "all" && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center">
                    Status: {filterStatus}
                    <button onClick={() => handleFilterChange('status', 'all')} className="ml-1 hover:text-green-900">×</button>
                  </span>
                )}
                {filterCrop && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs flex items-center">
                    Crop: {getCropDetails(filterCrop)?.name}
                    <button onClick={() => handleFilterChange('crop', '')} className="ml-1 hover:text-purple-900">×</button>
                  </span>
                )}
                {filterMarket && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs flex items-center">
                    Market: {getMarketDetails(filterMarket)?.name}
                    <button onClick={() => handleFilterChange('market', '')} className="ml-1 hover:text-yellow-900">×</button>
                  </span>
                )}
              </div>
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Alerts Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Crop & Market
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  // Loading skeleton
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-6 py-4">
                        <div className="animate-pulse flex space-x-4">
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-lg mb-2">No alerts found</p>
                      <p className="text-gray-400 text-sm mb-4">Try adjusting your filters or check back later</p>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  alerts.map((alert) => {
                    const user = getUserDetails(alert.userId);
                    const crop = getCropDetails(alert.cropId);
                    const market = getMarketDetails(alert.marketId);
                    
                    return (
                      <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <Users className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{user?.name || 'Unknown User'}</div>
                              <div className="text-xs text-gray-500">{user?.email || alert.userId}</div>
                              {user?.phone && (
                                <div className="text-xs text-gray-400">{user.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center text-sm">
                              <Package className="w-3 h-3 text-gray-400 mr-1" />
                              <span className="font-medium">{crop?.name || 'Unknown Crop'}</span>
                              {crop?.category && (
                                <span className="ml-2 text-xs text-gray-500">({crop.category})</span>
                              )}
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="w-3 h-3 text-gray-400 mr-1" />
                              {market?.name || 'Unknown Market'}
                              {market?.province && (
                                <span className="ml-1 text-xs text-gray-500">- {market.province}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <DollarSign className="w-4 h-4 text-green-500 mr-1" />
                            <span className="text-lg font-semibold text-green-600">
                              {alert.targetPrice.toFixed(2)}
                            </span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <StatusBadge 
                            status={alert.isActive ? "success" : "default"}
                            text={alert.isActive ? "Active" : "Inactive"}
                          />
                        </td>
                        
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(alert.createdAt)}
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleAlertStatus(alert)}
                              disabled={isLoading}
                              className={`p-1.5 rounded-full transition-colors ${
                                alert.isActive 
                                  ? 'text-green-600 hover:bg-green-50' 
                                  : 'text-gray-400 hover:bg-gray-100'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={alert.isActive ? "Deactivate" : "Activate"}
                            >
                              {alert.isActive ? (
                                <ToggleRight className="w-5 h-5" />
                              ) : (
                                <ToggleLeft className="w-5 h-5" />
                              )}
                            </button>
                            
                            <button
                              onClick={() => deleteAlert(alert.id)}
                              disabled={isLoading}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} alerts
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1 bg-green-600 text-white rounded-lg">
                  {currentPage}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || isLoading}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Refresh Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={fetchAllData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading.alerts ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
}