import React from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { CalendarEvent } from '../../types';
import { Plus } from 'lucide-react';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (date: Date) => void;
  onAddEventOnDate?: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  onSelectEvent,
  onSelectDay,
  onAddEventOnDate,
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/75 text-center text-xs font-bold text-slate-600 py-3">
        {weekDayLabels.map((dayName, idx) => (
          <div key={dayName} className={idx >= 5 ? 'text-purple-700/70' : ''}>
            {dayName}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[640px]">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          // Get events matching this date
          const dayEvents = events.filter((e) => {
            try {
              return isSameDay(new Date(e.start), day);
            } catch {
              return false;
            }
          });

          const visibleEvents = dayEvents.slice(0, 3);
          const hiddenCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={day.toISOString()}
              className={`p-1.5 sm:p-2 min-h-[110px] sm:min-h-[125px] flex flex-col justify-between group transition-colors relative ${
                !isCurrentMonth ? 'bg-slate-50/60 text-slate-400' : 'bg-white hover:bg-slate-50/50'
              }`}
            >
              {/* Day Cell Top: Number & Quick Add Button */}
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full transition-transform hover:scale-110 ${
                    isCurrentDay
                      ? 'bg-purple-600 text-white shadow-sm'
                      : isCurrentMonth
                      ? 'text-slate-800 hover:bg-slate-200'
                      : 'text-slate-400'
                  }`}
                  title="View full day schedule"
                >
                  {format(day, 'd')}
                </button>

                {onAddEventOnDate && (
                  <button
                    type="button"
                    onClick={() => onAddEventOnDate(day)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-all"
                    title={`Add event on ${format(day, 'dd MMM')}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Events Stack */}
              <div className="space-y-1 flex-1 overflow-hidden">
                {visibleEvents.map((evt) => {
                  const startTime = evt.isAllDay ? '' : format(new Date(evt.start), 'hh:mm a');
                  return (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className={`w-full text-left p-1 sm:px-1.5 sm:py-1 rounded-lg text-[11px] font-medium transition-all hover:brightness-95 flex items-center gap-1.5 border shadow-2xs truncate ${evt.color.bg} ${evt.color.text} ${evt.color.border}`}
                      title={`${evt.title} (${evt.type})${evt.clientName ? ` • ${evt.clientName}` : ''}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${evt.color.dot}`} />
                      <span className="truncate flex-1 font-semibold">{evt.title}</span>
                      {startTime && (
                        <span className="text-[10px] opacity-75 shrink-0 hidden sm:inline">
                          {startTime}
                        </span>
                      )}
                    </button>
                  );
                })}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="w-full text-center py-0.5 px-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

