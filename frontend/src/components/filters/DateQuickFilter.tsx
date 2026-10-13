import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar } from 'lucide-react';
import { DATE_PRESETS, DatePreset, getPresetDateStrings } from '../../utils/datePresets';
import { Button } from '../ui/Button';

export interface DateQuickFilterProps {
  selectedPreset?: DatePreset | string;
  startDate?: string;
  endDate?: string;
  onChange: (preset: DatePreset, startDate?: string, endDate?: string) => void;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export const DateQuickFilter: React.FC<DateQuickFilterProps> = ({
  selectedPreset = '',
  startDate = '',
  endDate = '',
  onChange,
  compact = false,
  disabled = false,
  className = '',
  label,
}) => {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);
  const [customError, setCustomError] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const customBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync state when props change
  useEffect(() => {
    setCustomStart(startDate);
    setCustomEnd(endDate);
  }, [startDate, endDate]);

  const updatePosition = useCallback(() => {
    if (!customBtnRef.current) return;
    const rect = customBtnRef.current.getBoundingClientRect();
    const popoverWidth = 288; // w-72 in Tailwind is 18rem = 288px
    const popoverHeight = 260; // approximate height

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }

    let top = rect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - 12 && rect.top - popoverHeight - 6 > 0) {
      top = rect.top - popoverHeight - 6;
    }

    setCoords({ top, left });
  }, []);

  const handleCancelCustom = useCallback(() => {
    setCustomStart(startDate);
    setCustomEnd(endDate);
    setCustomError('');
    setIsCustomOpen(false);
  }, [startDate, endDate]);

  // Click outside and keydown listeners when popover is open
  useEffect(() => {
    if (!isCustomOpen) return;

    updatePosition();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        customBtnRef.current &&
        !customBtnRef.current.contains(target)
      ) {
        handleCancelCustom();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancelCustom();
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
    };
  }, [isCustomOpen, handleCancelCustom, updatePosition]);

  const handleSelectPreset = (presetKey: DatePreset) => {
    if (disabled) return;

    if (presetKey === 'custom') {
      if (isCustomOpen) {
        handleCancelCustom();
      } else {
        setCustomStart(startDate);
        setCustomEnd(endDate);
        setCustomError('');
        updatePosition();
        setIsCustomOpen(true);
      }
      return;
    }

    setIsCustomOpen(false);
    setCustomError('');

    if (presetKey === '' || presetKey === 'allTime' || presetKey === 'all') {
      onChange('', '', '');
      return;
    }

    if (selectedPreset === presetKey) {
      // Toggle off / clear filter if same preset clicked
      onChange('', '', '');
      return;
    }

    const { startDate: sDate, endDate: eDate } = getPresetDateStrings(presetKey);
    onChange(presetKey, sDate, eDate);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart && !customEnd) {
      setCustomError('Please select at least a start or end date.');
      return;
    }

    if (customStart && customEnd && customStart > customEnd) {
      setCustomError('Start date cannot be after end date.');
      return;
    }

    setCustomError('');
    setIsCustomOpen(false);
    onChange('custom', customStart, customEnd);
  };

  const isAllTimeActive =
    (!selectedPreset || selectedPreset === '' || selectedPreset === 'allTime' || selectedPreset === 'all') &&
    !startDate &&
    !endDate;

  return (
    <div className={`relative inline-flex flex-col gap-1 ${className}`}>
      {label && (
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
          {label}
        </span>
      )}

      {/* Horizontal Button Container */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
        {DATE_PRESETS.map((p) => {
          const isActive = p.key === '' ? isAllTimeActive : selectedPreset === p.key;
          const isCustom = p.key === 'custom';

          return (
            <button
              key={p.key}
              ref={isCustom ? customBtnRef : undefined}
              type="button"
              disabled={disabled}
              aria-haspopup={isCustom ? 'dialog' : undefined}
              aria-expanded={isCustom ? isCustomOpen : undefined}
              aria-controls={isCustom ? 'custom-date-popover' : undefined}
              onClick={() => handleSelectPreset(p.key)}
              className={`inline-flex items-center justify-center font-medium rounded-lg transition-all select-none whitespace-nowrap cursor-pointer ${
                compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
              } ${
                isActive
                  ? 'bg-purple-600 text-white font-semibold shadow-xs border border-purple-600'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {p.label}
              {isCustom && selectedPreset === 'custom' && (startDate || endDate) && (
                <span className="ml-1 opacity-90 text-[10px] hidden md:inline">
                  ({startDate || '...'} to {endDate || '...'})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Portaled Custom Range Popover */}
      {isCustomOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            id="custom-date-popover"
            role="dialog"
            aria-modal="true"
            aria-label="Custom Date Range Picker"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
            }}
            className="w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-3.5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-xs font-bold text-slate-900">Custom Date Range</span>
              </div>
              <button
                type="button"
                onClick={handleCancelCustom}
                aria-label="Close custom date range"
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md p-1 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleApplyCustom} className="space-y-3">
              <div>
                <label
                  htmlFor="custom-filter-start-date"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Start Date
                </label>
                <input
                  id="custom-filter-start-date"
                  type="date"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setCustomError('');
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-filter-end-date"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  End Date
                </label>
                <input
                  id="custom-filter-end-date"
                  type="date"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setCustomError('');
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {customError && (
                <div
                  role="alert"
                  className="text-[11px] text-rose-600 font-medium bg-rose-50 border border-rose-200 rounded-lg p-2"
                >
                  {customError}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelCustom}
                  className="text-xs py-1 h-7"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs py-1 h-7 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Apply
                </Button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};
