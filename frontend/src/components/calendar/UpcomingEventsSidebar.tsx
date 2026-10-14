import React from 'react';
import { CalendarEvent, CalendarStats } from '../../types';
import { formatDate, formatDateTime } from '../../utils/formatters';
import {
  Calendar as CalendarIcon,
  CheckSquare,
  Film,
  Video,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface UpcomingEventsSidebarProps {
  events: CalendarEvent[];
  stats?: CalendarStats;
  onSelectEvent: (event: CalendarEvent) => void;
  isAdmin?: boolean;
}

export const UpcomingEventsSidebar: React.FC<UpcomingEventsSidebarProps> = ({
  events,
  stats,
  onSelectEvent,
  isAdmin = false,
}) => {
  const now = new Date();

  // Upcoming items from now onwards
  const upcomingEvents = events
    .filter((e) => new Date(e.start).getTime() >= now.getTime() - 24 * 60 * 60 * 1000)
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Quick Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Schedule Overview
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tasks</span>
            </div>
            <span className="font-extrabold text-emerald-900">{stats?.tasks || 0}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-purple-800 font-semibold">
              <Film className="w-3.5 h-3.5 text-purple-600" />
              <span>Content</span>
            </div>
            <span className="font-extrabold text-purple-900">{stats?.content || 0}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-blue-800 font-semibold">
              <Video className="w-3.5 h-3.5 text-blue-600" />
              <span>Calls</span>
            </div>
            <span className="font-extrabold text-blue-900">{stats?.meetings || 0}</span>
          </div>

          {isAdmin ? (
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Renewals</span>
              </div>
              <span className="font-extrabold text-amber-900">{stats?.renewals || 0}</span>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Total</span>
              </div>
              <span className="font-extrabold text-slate-900">{stats?.total || 0}</span>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Activities Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Upcoming Next
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">Next 6</span>
        </div>

        <div className="space-y-2">
          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4 italic">
              No upcoming items in this window.
            </p>
          ) : (
            upcomingEvents.map((evt) => (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.01] hover:shadow-2xs ${evt.color.bg} ${evt.color.border}`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${evt.color.badge}`}>
                    {evt.type}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {evt.isAllDay ? formatDate(evt.start) : formatDateTime(evt.start, 'dd MMM, hh:mm a')}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 line-clamp-1">{evt.title}</h4>
                {evt.clientName && (
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{evt.clientName}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

