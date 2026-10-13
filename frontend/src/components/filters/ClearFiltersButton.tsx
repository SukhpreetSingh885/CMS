import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

interface ClearFiltersButtonProps {
  onClear: () => void;
  activeCount?: number;
  className?: string;
}

export const ClearFiltersButton: React.FC<ClearFiltersButtonProps> = ({
  onClear,
  activeCount = 0,
  className = '',
}) => {
  if (activeCount === 0) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClear}
      className={`flex items-center gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 transition-colors ${className}`}
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Clear ({activeCount})
    </Button>
  );
};

