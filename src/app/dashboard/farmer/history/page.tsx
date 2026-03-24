"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import PriceTrendChart from "@/components/PriceTrendChart";
import { 
  TrendingUp, MapPin, Package, DollarSign, 
  Calendar, Download, AlertCircle, Loader2,
  ChevronLeft, ChevronRight, Search, Filter
} from "lucide-react";

interface Price {
  id: string;
  cropId: string;
  cropName: string;
  marketId: string;
  marketName: string;
  price: number;
  predictedPrice?: number;
  previousPrice?: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
  unit?: string;
  priceDate: string;
}

interface PriceHistory {
  date: string;
  price: number;
  predicted?: number;
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

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function PricesPage() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(10);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const [loading, setLoading] = useState({
    prices: true,
    crops: true,
    markets: true,
    history: false,
    export: false
  });
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch crops and markets
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        // Fetch crops
        const cropsRes = await fetch("/api/admin/crops", { credentials: "include" });
        if (cropsRes.ok) {
          const data = await cropsRes.json();
          setCrops(Array.isArray(data) ? data : data.data || []);
        }
        setLoading(prev => ({ ...prev, crops: false }));

        // Fetch markets
        const marketsRes = await fetch("/api/admin/markets", { credentials: "include" });
        if (marketsRes.ok) {
          const data = await marketsRes.json();
          setMarkets(Array.isArray(data) ? data : data.data || []);
        }
        setLoading(prev => ({ ...prev, markets: false }));
      } catch (err) {
        console.error("Error fetching filters:", err);
      }
    };

    fetchFilters();
  }, []);

  // Fetch prices with filters and pagination
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setLoading(prev => ({ ...prev, prices: true }));
        
        // Build query params
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString()
        });
        
        if (selectedCrop) params.append('crop', selectedCrop);
        if (selectedMarket) params.append('market', selectedMarket);
        if (searchTerm) params.append('search', searchTerm);
        if (dateFrom) params.append('from', dateFrom);
        if (dateTo) params.append('to', dateTo);
        
        const res = await fetch(`/api/farmer/prices?${params.toString()}`, { 
          credentials: "include",
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = '/login';
            return;
          }
          throw new Error('Failed to fetch prices');
        }
        
        const response: ApiResponse<Price[]> = await res.json();
        
        if (response.success) {
          setPrices(response.data || []);
          if (response.pagination) {
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.total);
          }
        } else {
          setError(response.error || 'Failed to load prices');
        }
      } catch (err) {
        setError("Failed to load price data");
        console.error("Error fetching prices:", err);
      } finally {
        setLoading(prev => ({ ...prev, prices: false }));
      }
    };

    fetchPrices();
  }, [currentPage, selectedCrop, selectedMarket, searchTerm, dateFrom, dateTo, itemsPerPage]);

  // Fetch price history when crop and market are selected
  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedCrop || !selectedMarket) return;
      
      try {
        setLoading(prev => ({ ...prev, history: true }));
        const res = await fetch(
          `/api/farmer/prices/history?crop=${encodeURIComponent(selectedCrop)}&market=${encodeURIComponent(selectedMarket)}&days=30`,
          { credentials: "include" }
        );
        
        if (res.ok) {
          const data = await res.json();
          setPriceHistory(data.data || []);
        }
      } catch (err) {
        console.error("Error fetching price history:", err);
      } finally {
        setLoading(prev => ({ ...prev, history: false }));
      }
    };

    fetchHistory();
  }, [selectedCrop, selectedMarket]);

  // Handle export to CSV
  const handleExport = async () => {
    try {
      setLoading(prev => ({ ...prev, export: true }));
      
      const params = new URLSearchParams();
      if (selectedCrop) params.append('crop', selectedCrop);
      if (selectedMarket) params.append('market', selectedMarket);
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      
      const res = await fetch(`/api/farmer/prices/export?${params.toString()}`, {
        credentials: "include"
      });
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prices-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage("Export completed successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError("Failed to export data");
      console.error("Export error:", err);
    } finally {
      setLoading(prev => ({ ...prev, export: false }));
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCrop("");
    setSelectedMarket("");
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  // Get trend icon based on price change
  const getTrendIcon = (trend: string) => {
    switch(trend) {
      case 'up': 
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down': 
        return <TrendingUp className="w-4 h-4 text-red-600 transform rotate-180" />;
      default: 
        return <TrendingUp className="w-4 h-4 text-gray-400" />;
    }
  };

  // Calculate price change percentage
  const getPriceChange = (current: number, previous?: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      percentage: Math.abs(change).toFixed(1),
      direction: change >= 0 ? 'up' : 'down'
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-green-100 shadow-sm sticky top-0 z-10">
        <div className="px-4 sm:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Market Prices
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                View and analyze crop prices across all markets
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Success/Error Messages */}
              {successMessage && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
                  {successMessage}
                </div>
              )}
              
              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={loading.export || prices.length === 0}
                className="flex items-center space-x-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.export ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Export</span>
              </button>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
            <div className="flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button 
                onClick={() => setError(null)} 
                className="ml-4 text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Filters Section */}
        {showFilters && (
          <Card className="mb-8">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search crops or markets..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Crop Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Crop
                  </label>
                  <select
                    value={selectedCrop}
                    onChange={(e) => {
                      setSelectedCrop(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={loading.crops}
                  >
                    <option value="">All Crops</option>
                    {crops.map((crop) => (
                      <option key={crop.id} value={crop.name}>
                        {crop.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Market Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Market
                  </label>
                  <select
                    value={selectedMarket}
                    onChange={(e) => {
                      setSelectedMarket(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={loading.markets}
                  >
                    <option value="">All Markets</option>
                    {markets.map((market) => (
                      <option key={market.id} value={market.name}>
                        {market.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Price History Chart (when crop and market selected) */}
        {selectedCrop && selectedMarket && (
          <Card className="mb-8">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Price History: {selectedCrop} in {selectedMarket}
              </h2>
              {loading.history ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                </div>
              ) : priceHistory.length > 0 ? (
                <div className="h-64">
                  <PriceTrendChart
                    labels={priceHistory.map(h => h.date)}
                    prices={priceHistory.map(h => h.price)}
                    predictions={priceHistory.map(h => h.predicted || 0)}
                  />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-gray-500">No history data available</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Prices Table */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Price Listings
                {totalItems > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({totalItems} records)
                  </span>
                )}
              </h2>
            </div>

            {loading.prices ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-gray-100 rounded"></div>
                  </div>
                ))}
              </div>
            ) : prices.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-sm sm:text-base text-gray-500 mb-2">
                  No price data available
                </p>
                <p className="text-xs sm:text-sm text-gray-400">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Crop
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Market
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unit
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {prices.map((price) => {
                          const change = getPriceChange(price.price, price.previousPrice);
                          return (
                            <tr key={price.id} className="hover:bg-green-50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <Package className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                                  <span className="text-sm font-medium text-gray-900">
                                    {price.cropName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <MapPin className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                                  <span className="text-sm text-gray-700">
                                    {price.marketName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm font-semibold text-green-700">
                                  ZMW {price.price.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                {price.unit || '50kg bag'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(price.priceDate || price.lastUpdated).toLocaleDateString('en-ZM')}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {change ? (
                                  <div className={`flex items-center space-x-1 ${
                                    change.direction === 'up' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {getTrendIcon(change.direction)}
                                    <span className="text-xs font-medium">
                                      {change.percentage}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-3 py-1 bg-green-600 text-white rounded-lg">
                        {currentPage}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Summary Stats */}
        {prices.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-1">Average Price</p>
                <p className="text-xl font-bold text-gray-900">
                  ZMW {(prices.reduce((acc, p) => acc + p.price, 0) / prices.length).toFixed(2)}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-1">Highest Price</p>
                <p className="text-xl font-bold text-green-600">
                  ZMW {Math.max(...prices.map(p => p.price)).toFixed(2)}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-1">Lowest Price</p>
                <p className="text-xl font-bold text-orange-600">
                  ZMW {Math.min(...prices.map(p => p.price)).toFixed(2)}
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translate(-50%, -10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}