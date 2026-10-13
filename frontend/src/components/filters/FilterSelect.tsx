import React from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

interface FilterSelectProps {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const FilterSelect: React.FC<FilterSelectProps> = ({
  label,
  value = '',
  onChange,
  options,
  placeholder = 'All',
  className = '',
  disabled = false,
}) => {
  const isFiltered = Boolean(value && value !== 'ALL');

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-[11px] font-semibold text-slate-600">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`px-3 py-2 text-xs rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isFiltered
            ? 'bg-purple-50/50 border-purple-300 text-purple-900 font-semibold ring-1 ring-purple-400'
            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

