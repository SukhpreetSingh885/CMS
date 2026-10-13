import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui/Button';
import { ActiveFilterChips, ActiveFilterItem } from './ActiveFilterChips';

export interface FilterToolbarProps {
  /** Optional DateQuickFilter element rendered in the unified toolbar */
  dateFilter?: React.ReactNode;
  /** Primary filter controls: SearchInput, FilterSelects, toggles */
  children?: React.ReactNode;
  /** Count of total filtered results */
  totalResults?: number;
  /** Label for results count (e.g. "clients", "tasks", "invoices") */
  resultsLabel?: string;
  /** Active filter badges */
  activeFilters?: ActiveFilterItem[];
  onRemoveFilter?: (key: string) => void;
  onClearAllFilters?: () => void;
  /** Optional handler to open non-duplicated advanced filters */
  onOpenAdvanced?: () => void;
  advancedCount?: number;
  advancedLabel?: string;
  className?: string;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  dateFilter,
  children,
  totalResults,
  resultsLabel = 'records',
  activeFilters = [],
  onRemoveFilter,
  onClearAllFilters,
  onOpenAdvanced,
  advancedCount = 0,
  advancedLabel = 'Advanced Filters',
  className = '',
}) => {
  const hasControls = Boolean(children || onOpenAdvanced);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Unified Single Filter Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs divide-y divide-slate-100">
        {/* Date Presets Row (horizontally scrollable on mobile) */}
        {dateFilter && (
          <div className="p-3 sm:px-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            <div className="flex-1 min-w-0 max-w-full overflow-x-auto no-scrollbar">
              {dateFilter}
            </div>
            {!hasControls && totalResults !== undefined && (
              <div className="text-xs text-slate-500 font-medium pl-2 whitespace-nowrap hidden sm:block">
                Showing <span className="font-bold text-slate-900">{totalResults}</span> {resultsLabel}
              </div>
            )}
          </div>
        )}

        {/* Primary Filter Controls Row */}
        {hasControls && (
          <div className="p-3 sm:px-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
              {children}

              {onOpenAdvanced && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenAdvanced}
                  className={`flex items-center gap-1.5 text-xs h-9 ${
                    advancedCount > 0
                      ? 'bg-purple-50 text-purple-700 border-purple-300 font-semibold ring-1 ring-purple-400'
                      : 'text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {advancedLabel}
                  {advancedCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {advancedCount}
                    </span>
                  )}
                </Button>
              )}
            </div>

            {totalResults !== undefined && (
              <div className="text-xs text-slate-500 font-medium pl-2 whitespace-nowrap">
                Showing <span className="font-bold text-slate-900">{totalResults}</span> {resultsLabel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && onRemoveFilter && onClearAllFilters && (
        <ActiveFilterChips
          filters={activeFilters}
          onRemove={onRemoveFilter}
          onClearAll={onClearAllFilters}
        />
      )}
    </div>
  );
};

