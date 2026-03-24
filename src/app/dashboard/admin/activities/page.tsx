"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import { 
  Activity, 
  Users, 
  TrendingUp, 
  Bell, 
  MessageSquare, 
  Package, 
  MapPin,
  AlertCircle,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: 'user' | 'price' | 'alert' | 'sms' | 'crop' | 'market';
  description: string;
  timestamp: string;
  status?: string;
  metadata?: any;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiResponse {
  success: boolean;
  data: ActivityItem[];
  pagination: PaginationInfo;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filterType, setFilterType] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination - Fixed: Initialize with proper structure
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0  // Changed from 1 to 0 to better represent no pages
  });

  // Fetch activities
  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pagination.limit.toString()
      });
      
      if (filterType) params.append('type', filterType);
      if (filterDate) params.append('date', filterDate);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/admin/activities?${params.toString()}`, {
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
        throw new Error('Failed to fetch activities');
      }

      const result: ApiResponse = await response.json();
      
      if (result.success) {
        setActivities(result.data || []);
        // Fixed: Safely set pagination with fallback values
        setPagination({
          total: result.pagination?.total ?? 0,
          page: result.pagination?.page ?? currentPage,
          limit: result.pagination?.limit ?? pagination.limit,
          totalPages: result.pagination?.totalPages ?? 1
        });
      } else {
        throw new Error('Failed to load activities');
      }
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError(err instanceof Error ? err.message : "Failed to load activities");
      // Reset pagination on error
      setPagination(prev => ({
        ...prev,
        total: 0,
        totalPages: 0
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [currentPage, filterType, filterDate, searchTerm]);

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
      
      return date.toLocaleDateString('en-ZM', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Get icon for activity type
  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'user':
        return <Users className="w-4 h-4" />;
      case 'price':
        return <TrendingUp className="w-4 h-4" />;
      case 'alert':
        return <Bell className="w-4 h-4" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4" />;
      case 'crop':
        return <Package className="w-4 h-4" />;
      case 'market':
        return <MapPin className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  // Get background color for activity type
  const getActivityColor = (type: string) => {
    switch(type) {
      case 'user': return 'bg-blue-100 text-blue-600';
      case 'price': return 'bg-green-100 text-green-600';
      case 'alert': return 'bg-red-100 text-red-600';
      case 'sms': return 'bg-yellow-100 text-yellow-600';
      case 'crop': return 'bg-purple-100 text-purple-600';
      case 'market': return 'bg-indigo-100 text-indigo-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilterType("");
    setFilterDate("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  // Export activities as CSV
  const exportToCSV = () => {
    if (!activities.length) return;
    
    const headers = ['Type', 'Description', 'User', 'Status', 'Date'];
    const csvData = activities.map(a => [
      a.type,
      a.description,
      a.user?.name || 'System',
      a.status || 'N/A',
      new Date(a.timestamp).toLocaleString()
    ]);
    
    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activities-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Fixed: Safe pagination calculations
  const startItem = ((currentPage - 1) * pagination.limit) + 1;
  const endItem = Math.min(currentPage * pagination.limit, pagination.total);
  const hasNextPage = currentPage < (pagination.totalPages ?? 0);
  const hasPrevPage = currentPage > 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
            <p className="text-gray-600 mt-1">Track all system activities and user actions</p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={activities.length === 0 || loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{error}</span>
              <button 
                onClick={() => setError(null)} 
                className="ml-auto hover:text-red-900"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                id="search"
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                Activity Type
              </label>
              <select
                id="type"
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="user">User Actions</option>
                <option value="price">Price Updates</option>
                <option value="alert">Alert Triggers</option>
                <option value="sms">SMS Messages</option>
                <option value="crop">Crop Management</option>
                <option value="market">Market Management</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Active Filters */}
          {(filterType || filterDate || searchTerm) && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">Active filters:</span>
                {filterType && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center">
                    Type: {filterType}
                    <button 
                      onClick={() => setFilterType("")} 
                      className="ml-1 hover:text-blue-900"
                      aria-label="Remove type filter"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filterDate && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center">
                    Date: {new Date(filterDate).toLocaleDateString()}
                    <button 
                      onClick={() => setFilterDate("")} 
                      className="ml-1 hover:text-green-900"
                      aria-label="Remove date filter"
                    >
                      ×
                    </button>
                  </span>
                )}
                {searchTerm && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs flex items-center">
                    Search: {searchTerm}
                    <button 
                      onClick={() => setSearchTerm("")} 
                      className="ml-1 hover:text-purple-900"
                      aria-label="Remove search filter"
                    >
                      ×
                    </button>
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

        {/* Activities List */}
        <Card>
          <div className="divide-y divide-gray-200">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-6 animate-pulse">
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : !activities || activities.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-lg mb-2">No activities found</p>
                <p className="text-gray-400 text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </p>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                          {formatDate(activity.timestamp)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-gray-500 capitalize">
                          {activity.type}
                        </span>
                        
                        {activity.user && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-600">
                              by {activity.user.name}
                            </span>
                          </>
                        )}
                        
                        {activity.status && (
                          <>
                            <span className="text-gray-300">•</span>
                            <StatusBadge 
                              status={activity.status} 
                              size="sm"
                            />
                          </>
                        )}
                      </div>

                      {/* Metadata (if any) */}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 text-xs bg-gray-50 p-2 rounded">
                          <pre className="text-gray-600 whitespace-pre-wrap">
                            {JSON.stringify(activity.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Fixed: Safe pagination rendering */}
          {(pagination.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {pagination.total > 0 ? (
                  <>Showing {startItem} to {endItem} of {pagination.total} activities</>
                ) : (
                  <>No activities to display</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={!hasPrevPage || loading}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 bg-green-600 text-white rounded-lg">
                  {currentPage}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages ?? 1))}
                  disabled={!hasNextPage || loading}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Refresh Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={fetchActivities}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}