import React from 'react';

export interface DateRangeFilterProps {
  label?: string;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  onChange?: (start: string, end: string) => void;
  className?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  label,
  startDate = '',
  endDate = '',
  onStartDateChange,
  onEndDateChange,
  onChange,
  className = '',
}) => {
  const isFiltered = Boolean(startDate || endDate);

  const handleStart = (val: string) => {
    if (onStartDateChange) onStartDateChange(val);
    if (onChange) onChange(val, endDate);
  };

  const handleEnd = (val: string) => {
    if (onEndDateChange) onEndDateChange(val);
    if (onChange) onChange(startDate, val);
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-[11px] font-semibold text-slate-600">{label}</label>}
      <div
        className={`flex items-center gap-1.5 p-1 rounded-lg border transition-all ${
          isFiltered
            ? 'bg-purple-50/50 border-purple-300 ring-1 ring-purple-400'
            : 'bg-white border-slate-200'
        }`}
      >
        <input
          type="date"
          value={startDate}
          onChange={(e) => handleStart(e.target.value)}
          className="px-2 py-1 text-xs bg-transparent text-slate-800 focus:outline-none cursor-pointer"
          title="From date"
        />
        <span className="text-slate-400 text-xs font-medium">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => handleEnd(e.target.value)}
          className="px-2 py-1 text-xs bg-transparent text-slate-800 focus:outline-none cursor-pointer"
          title="To date"
        />
      </div>
    </div>
  );
};

