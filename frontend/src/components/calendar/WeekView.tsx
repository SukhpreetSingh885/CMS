import React from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
  getHours,
} from 'date-fns';
import { CalendarEvent } from '../../types';
import { Video, Film, CheckSquare, Clock } from 'lucide-react';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (date: Date) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  events,
  onSelectEvent,
  onSelectDay,
}) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Hours displayed: 8 AM (8) to 8 PM (20)
  const hours = Array.from({ length: 13 }, (_, i) => i + 8);

  // Separate all-day events / deadlines (Tasks, Renewals) from timed events (Meetings, Content)
  const allDayEvents = events.filter((e) => e.isAllDay);
  const timedEvents = events.filter((e) => !e.isAllDay);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Week Header Row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10">
        <div className="p-3 border-r border-slate-200 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center">
          <Clock className="w-3.5 h-3.5" />
        </div>

        {days.map((day) => {
          const isCurrentDay = isToday(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`p-2.5 sm:p-3 text-center border-r last:border-r-0 border-slate-200 transition-colors hover:bg-slate-100/60 ${
                isCurrentDay ? 'bg-purple-50/50' : ''
              }`}
            >
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {format(day, 'EEE')}
              </p>
              <div
                className={`w-7 h-7 mx-auto mt-1 flex items-center justify-center text-xs font-bold rounded-full ${
                  isCurrentDay ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-800'
                }`}
              >
                {format(day, 'd')}
              </div>
            </button>
          );
        })}
      </div>

      {/* All-Day / Deadlines Row */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50/40 text-xs">
          <div className="p-2 border-r border-slate-200 text-[10px] font-bold text-slate-500 flex items-center justify-center text-center">
            Due / All-Day
          </div>
          {days.map((day) => {
            const dayAllDay = allDayEvents.filter((e) => isSameDay(new Date(e.start), day));
            return (
              <div
                key={`allday-${day.toISOString()}`}
                className="p-1 border-r last:border-r-0 border-slate-200 space-y-1 min-h-[44px]"
              >
                {dayAllDay.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelectEvent(e)}
                    className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate border ${e.color.bg} ${e.color.text} ${e.color.border}`}
                    title={e.title}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Hourly Timeline Grid */}
      <div className="overflow-y-auto max-h-[600px] divide-y divide-slate-100">
        {hours.map((hour) => {
          const hourLabel = format(new Date().setHours(hour, 0, 0, 0), 'hh a');

          return (
            <div
              key={hour}
              className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[64px] divide-x divide-slate-100"
            >
              {/* Hour Label */}
              <div className="text-[10px] font-semibold text-slate-400 pr-2 pt-1.5 text-right select-none bg-slate-50/30">
                {hourLabel}
              </div>

              {/* 7 Days for this hour */}
              {days.map((day) => {
                const isCurrentDay = isToday(day);

                // Find timed events matching this day and this hour
                const cellEvents = timedEvents.filter((e) => {
                  const d = new Date(e.start);
                  return isSameDay(d, day) && getHours(d) === hour;
                });

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={`p-1 relative transition-colors ${
                      isCurrentDay ? 'bg-purple-50/20' : 'hover:bg-slate-50/40'
                    }`}
                  >
                    {cellEvents.map((evt) => (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => onSelectEvent(evt)}
                        className={`w-full text-left p-1.5 rounded-lg text-xs font-semibold mb-1 border shadow-2xs transition-all hover:scale-[1.01] ${evt.color.bg} ${evt.color.text} ${evt.color.border}`}
                      >
                        <div className="flex items-center justify-between text-[10px] opacity-80 mb-0.5">
                          <span>{format(new Date(evt.start), 'hh:mm a')}</span>
                          {evt.platform && (
                            <span className="px-1 py-0.2 rounded bg-purple-200/60 text-purple-800">
                              {evt.platform}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-1 font-bold">{evt.title}</p>
                        {evt.clientName && (
                          <p className="text-[10px] opacity-75 truncate">{evt.clientName}</p>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

