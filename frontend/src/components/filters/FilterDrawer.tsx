import React from 'react';
import { X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  onApply?: () => void;
  onReset?: () => void;
  activeFiltersCount?: number;
  children: React.ReactNode;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  title = 'Advanced Filters',
  onApply,
  onReset,
  activeFiltersCount,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {children}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          {onReset && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="flex items-center gap-1.5 text-slate-600 border-slate-300 hover:bg-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {onApply && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onApply();
                  onClose();
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              >
                Apply Filters
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
