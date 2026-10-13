import React from 'react';
import { AlertCircle, WifiOff, ShieldAlert, Database } from 'lucide-react';
import { RetryButton } from './RetryButton';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void | Promise<void>;
  isRetrying?: boolean;
  type?: 'generic' | 'network' | 'permission' | 'database';
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  onRetry,
  isRetrying = false,
  type = 'generic',
  className = '',
}) => {
  const getIcon = () => {
    switch (type) {
      case 'network':
        return <WifiOff className="w-8 h-8 text-amber-400" />;
      case 'permission':
        return <ShieldAlert className="w-8 h-8 text-red-400" />;
      case 'database':
        return <Database className="w-8 h-8 text-indigo-400" />;
      default:
        return <AlertCircle className="w-8 h-8 text-red-400" />;
    }
  };

  const defaultTitle =
    title ||
    (type === 'network'
      ? 'Network Connection Issue'
      : type === 'permission'
      ? 'Access Denied'
      : type === 'database'
      ? 'Service Temporarily Unavailable'
      : 'Failed to load data');

  const defaultMessage =
    message ||
    (type === 'network'
      ? 'Unable to connect to the server. Please check your internet connection.'
      : type === 'permission'
      ? 'You do not have permission to access or view this resource.'
      : type === 'database'
      ? 'The database service is currently unavailable. Please try again in a moment.'
      : 'An unexpected error occurred while fetching information.');

  return (
    <div
      className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center my-4 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-4 shadow-inner">
        {getIcon()}
      </div>

      <h3 className="text-lg font-semibold text-white mb-1.5">{defaultTitle}</h3>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">{defaultMessage}</p>

      {onRetry && (
        <RetryButton onRetry={onRetry} isLoading={isRetrying} label="Try Again" />
      )}
    </div>
  );
};

