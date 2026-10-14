import React from 'react';
import { CalendarStats, Client, User } from '../../types';
import { CheckSquare, Film, Video, AlertTriangle, Layers, X, Filter } from 'lucide-react';

interface CalendarFiltersProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedClientId: string;
  onClientChange: (clientId: string) => void;
  selectedEmployeeId?: string;
  onEmployeeChange?: (employeeId: string) => void;
  clients: Client[];
  employees?: User[];
  stats?: CalendarStats;
  isAdmin?: boolean;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  selectedType,
  onTypeChange,
  selectedClientId,
  onClientChange,
  selectedEmployeeId,
  onEmployeeChange,
  clients,
  employees = [],
  stats,
  isAdmin = false,
  onClearFilters,
  hasActiveFilters,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
      {/* Activity Type Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => onTypeChange('ALL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
            selectedType === 'ALL'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Activities</span>
          {stats && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedType === 'ALL' ? 'bg-purple-800 text-purple-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {stats.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTypeChange('TASK')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
            selectedType === 'TASK'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Tasks</span>
          {stats && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedType === 'TASK' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-200 text-emerald-800'
              }`}
            >
              {stats.tasks}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTypeChange('CONTENT')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
            selectedType === 'CONTENT'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Content</span>
          {stats && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedType === 'CONTENT' ? 'bg-purple-800 text-purple-100' : 'bg-purple-200 text-purple-800'
              }`}
            >
              {stats.content}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTypeChange('MEETING')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
            selectedType === 'MEETING'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Meetings</span>
          {stats && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedType === 'MEETING' ? 'bg-blue-800 text-blue-100' : 'bg-blue-200 text-blue-800'
              }`}
            >
              {stats.meetings}
            </span>
          )}
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => onTypeChange('RENEWAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
              selectedType === 'RENEWAL'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Renewals</span>
            {stats && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedType === 'RENEWAL' ? 'bg-amber-800 text-amber-100' : 'bg-amber-200 text-amber-800'
                }`}
              >
                {stats.renewals}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Select Dropdowns: Client & Employee */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Client dropdown */}
        <select
          value={selectedClientId}
          onChange={(e) => onClientChange(e.target.value)}
          className="text-xs rounded-xl border border-slate-200 px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>

        {/* Employee dropdown (Admin only) */}
        {isAdmin && onEmployeeChange && (
          <select
            value={selectedEmployeeId || ''}
            onChange={(e) => onEmployeeChange(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
          >
            <option value="">All Team Members</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName}
              </option>
            ))}
          </select>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-semibold transition-colors"
            title="Clear filters"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
};

