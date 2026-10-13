import React from 'react';
import { X, RotateCcw } from 'lucide-react';

export interface ActiveFilterItem {
  key: string;
  label: string;
  value?: string;
  displayValue?: string;
}

interface ActiveFilterChipsProps {
  filters: ActiveFilterItem[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  className?: string;
}

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  filters,
  onRemove,
  onClearAll,
  className = '',
}) => {
  if (filters.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 pt-2 ${className}`}>
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        Active Filters:
      </span>

      {filters.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-medium shadow-xs"
        >
          <span className="text-purple-500 font-normal">{f.label}:</span>
          <span>{f.displayValue ?? f.value}</span>
          <button
            type="button"
            onClick={() => onRemove(f.key)}
            className="p-0.5 hover:bg-purple-200 text-purple-600 rounded-full transition-colors ml-0.5"
            title={`Remove ${f.label} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-0.5 rounded hover:bg-rose-50 transition-colors ml-1"
      >
        <RotateCcw className="w-3 h-3" />
        Reset All
      </button>
    </div>
  );
};
