import React from 'react';
import { isSameDay, isToday, format, getHours } from 'date-fns';
import { CalendarEvent } from '../../types';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  Film,
  CheckSquare,
  AlertTriangle,
  ExternalLink,
  Building,
} from 'lucide-react';
import { formatDate, formatDateTime } from '../../utils/formatters';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent?: (type?: 'TASK' | 'CONTENT' | 'MEETING') => void;
}

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  onSelectEvent,
  onAddEvent,
}) => {
  const isCurrentDay = isToday(currentDate);

  // Filter events for this day
  const dayEvents = events.filter((e) => {
    try {
      return isSameDay(new Date(e.start), currentDate);
    } catch {
      return false;
    }
  });

  const allDayEvents = dayEvents.filter((e) => e.isAllDay);
  const timedEvents = dayEvents.filter((e) => !e.isAllDay);

  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 9 PM

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col space-y-4 p-4 sm:p-6">
      {/* Day Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
              {format(currentDate, 'EEEE')}
            </span>
            {isCurrentDay && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 uppercase tracking-wider">
                Today
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
            {format(currentDate, 'd MMMM yyyy')}
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="px-2.5 py-1 bg-slate-100 rounded-lg">
            {dayEvents.length} {dayEvents.length === 1 ? 'activity' : 'activities'} scheduled
          </span>
        </div>
      </div>

      {/* Deadlines & All-Day Tasks Section */}
      {allDayEvents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            <span>Deadlines & Renewals Due Today ({allDayEvents.length})</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allDayEvents.map((evt) => (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className={`p-3.5 rounded-xl border transition-all hover:shadow-md cursor-pointer ${evt.color.bg} ${evt.color.border}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${evt.color.badge}`}>
                    {evt.type}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200">
                    {evt.status}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{evt.title}</h4>
                {evt.clientName && (
                  <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{evt.clientName}</span>
                  </p>
                )}
                {evt.assignedToName && (
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Assigned: {evt.assignedToName}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly Schedule Timeline */}
      <div className="space-y-2 pt-2">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-purple-600" />
          <span>Timeline Schedule</span>
        </p>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {hours.map((hour) => {
            const hourLabel = format(new Date().setHours(hour, 0, 0, 0), 'hh:00 a');

            const hourEvents = timedEvents.filter((e) => {
              const d = new Date(e.start);
              return getHours(d) === hour;
            });

            return (
              <div
                key={hour}
                className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] min-h-[64px] divide-x divide-slate-100 group transition-colors hover:bg-slate-50/40"
              >
                {/* Hour badge */}
                <div className="p-2 sm:p-3 text-xs font-bold text-slate-500 bg-slate-50/60 select-none flex items-start justify-end pr-3">
                  {hourLabel}
                </div>

                {/* Events list in this hour */}
                <div className="p-2 space-y-2">
                  {hourEvents.length === 0 ? (
                    <div className="h-full min-h-[36px]" />
                  ) : (
                    hourEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => onSelectEvent(evt)}
                        className={`p-3 rounded-xl border transition-all hover:shadow-md cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${evt.color.bg} ${evt.color.border}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${evt.color.badge}`}>
                              {evt.type}
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                              {format(new Date(evt.start), 'hh:mm a')}
                              {evt.end && evt.start !== evt.end && (
                                <> – {format(new Date(evt.end), 'hh:mm a')}</>
                              )}
                            </span>
                            {evt.platform && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">
                                {evt.platform}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900">{evt.title}</h4>
                          {evt.clientName && (
                            <p className="text-xs text-slate-600 flex items-center gap-1">
                              <Building className="w-3.5 h-3.5 text-slate-400" />
                              <span>{evt.clientName}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {evt.meetingLink && (
                            <a
                              href={evt.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Join
                            </a>
                          )}
                          {evt.assignedToName && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200">
                              <span className="font-semibold">{evt.assignedToName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

