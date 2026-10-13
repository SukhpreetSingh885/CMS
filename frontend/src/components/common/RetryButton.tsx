import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

interface RetryButtonProps {
  onRetry: () => void | Promise<void>;
  isLoading?: boolean;
  label?: string;
  className?: string;
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry,
  isLoading = false,
  label = 'Retry',
  className = '',
}) => {
  return (
    <Button
      variant="outline"
      onClick={onRetry}
      disabled={isLoading}
      className={`flex items-center gap-2 border-slate-700 hover:bg-slate-800 text-slate-200 ${className}`}
    >
      <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      {label}
    </Button>
  );
};

