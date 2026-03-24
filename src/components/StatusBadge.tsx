import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'md', 
  className = '' 
}) => {
  // Safely handle undefined or null status
  const statusValue = status || 'unknown';
  const statusLower = statusValue.toLowerCase();

  const getStatusStyles = (status: string): string => {
    const statusMap: Record<string, string> = {
      success: 'bg-green-100 text-green-800 border-green-200',
      active: 'bg-green-100 text-green-800 border-green-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      info: 'bg-blue-100 text-blue-800 border-blue-200',
      default: 'bg-gray-100 text-gray-800 border-gray-200',
      unknown: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return statusMap[status] || statusMap.default;
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${getStatusStyles(statusLower)}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {status || 'Unknown'}
    </span>
  );
};

export default StatusBadge;