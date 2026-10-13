import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value = '',
  onChange,
  placeholder = 'Search...',
  debounceMs = 350,
  className = '',
}) => {
  const [localValue, setLocalValue] = useState(value);
  const isInitialMount = useRef(true);

  // Synchronize local input state when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce change notifications
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, onChange, debounceMs, value]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className={`relative flex items-center min-w-[220px] ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-sm"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          title="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

