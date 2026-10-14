import React, { useState } from 'react';
import { CalendarViewMode } from '../../types';
import { Button } from '../ui/Button';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Grid,
  Columns,
  List,
  Plus,
  RotateCw,
  Search,
  CheckSquare,
  Film,
  Video,
} from 'lucide-react';

interface CalendarHeaderProps {
  currentDateLabel: string;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
  isAdmin?: boolean;
  onOpenAddModal: (type?: 'TASK' | 'CONTENT' | 'MEETING') => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDateLabel,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
  onRefresh,
  isLoading = false,
  isAdmin = false,
  onOpenAddModal,
  searchQuery,
  onSearchChange,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Navigation and Date Title */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="text-xs font-bold text-slate-700 hover:text-purple-700 hover:border-purple-300"
          >
            Today
          </Button>

          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={onPrev}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight min-w-[180px]">
            {currentDateLabel}
          </h2>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-purple-600 transition-colors ${
              isLoading ? 'animate-spin text-purple-600' : ''
            }`}
            title="Refresh schedule"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="flex-1 max-w-xs relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search events, clients..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all placeholder:text-slate-400 text-slate-800"
          />
        </div>

        {/* Right: View Mode Segments & Add Event */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Segmented View Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => onViewModeChange('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'month'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Month</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'week'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Week</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'day'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Day</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Agenda</span>
            </button>
          </div>

          {/* Add Event Button (Admin Only) */}
          {isAdmin && (
            <div className="relative">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Event</span>
              </Button>

              {showAddMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowAddMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMenu(false);
                        onOpenAddModal('TASK');
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left font-medium"
                    >
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      Create Task Deadline
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMenu(false);
                        onOpenAddModal('CONTENT');
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors text-left font-medium"
                    >
                      <Film className="w-4 h-4 text-purple-600" />
                      Schedule Social Post
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMenu(false);
                        onOpenAddModal('MEETING');
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left font-medium"
                    >
                      <Video className="w-4 h-4 text-blue-600" />
                      Schedule Client Meeting
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

