import React, { useMemo } from 'react';
import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from 'date-fns';
import { CalendarEvent } from '../../types';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  Film,
  CheckSquare,
  AlertTriangle,
  Building,
  User as UserIcon,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../ui/Button';

interface ListViewProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onClearFilters?: () => void;
  hasFilters?: boolean;
}

export const ListView: React.FC<ListViewProps> = ({
  events,
  onSelectEvent,
  onClearFilters,
  hasFilters = false,
}) => {
  // Group events by date string (YYYY-MM-DD)
  const groupedEvents = useMemo(() => {
    const map = new Map<string, { date: Date; items: CalendarEvent[] }>();

    events.forEach((evt) => {
      try {
        const d = new Date(evt.start);
        const dateKey = format(d, 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, { date: d, items: [] });
        }
        map.get(dateKey)!.items.push(evt);
      } catch (err) {
        console.error('Invalid date on event', evt, err);
      }
    });

    // Sort by date key
    return Array.from(map.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_, val]) => val);
  }, [events]);

  const getDateBadge = (date: Date) => {
    if (isToday(date)) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 uppercase tracking-wider">
          Today
        </span>
      );
    }
    if (isTomorrow(date)) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase tracking-wider">
          Tomorrow
        </span>
      );
    }
    if (isYesterday(date)) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700 uppercase tracking-wider">
          Yesterday
        </span>
      );
    }
    return null;
  };

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
          <CalendarIcon className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No scheduled activities found</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          There are no task deadlines, content posts, meetings, or renewals scheduled for the selected range or filters.
        </p>
        {hasFilters && onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters} className="text-xs">
            Reset Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedEvents.map(({ date, items }) => (
        <div
          key={date.toISOString()}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          {/* Group Date Header */}
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {format(date, 'EEEE, d MMMM yyyy')}
              </span>
              {getDateBadge(date)}
            </div>
            <span className="text-xs font-medium text-slate-500">
              {items.length} {items.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          {/* Group Events List */}
          <div className="divide-y divide-slate-100">
            {items.map((evt) => (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className="p-3.5 sm:p-4 hover:bg-slate-50/60 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                {/* Event Left Info */}
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${evt.color.bg} ${evt.color.border}`}
                  >
                    {evt.type === 'TASK' && <CheckSquare className="w-4 h-4 text-emerald-600" />}
                    {evt.type === 'CONTENT' && <Film className="w-4 h-4 text-purple-600" />}
                    {evt.type === 'MEETING' && <Video className="w-4 h-4 text-blue-600" />}
                    {evt.type === 'RENEWAL' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${evt.color.badge}`}>
                        {evt.type}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {evt.isAllDay ? 'All Day / Deadline' : format(new Date(evt.start), 'hh:mm a')}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {evt.status}
                      </span>
                      {evt.platform && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">
                          {evt.platform}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                      {evt.title}
                    </h4>

                    {evt.clientName && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{evt.clientName}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Event Right Actions & Assignee */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  {evt.assignedToName && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium">{evt.assignedToName}</span>
                    </div>
                  )}

                  {evt.meetingLink && (
                    <a
                      href={evt.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Join Call
                    </a>
                  )}

                  <span className="text-xs text-purple-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

