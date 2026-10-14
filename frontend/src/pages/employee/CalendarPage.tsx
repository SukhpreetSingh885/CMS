import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  format,
} from 'date-fns';
import {
  calendarService,
  clientService,
} from '../../services';
import {
  CalendarEvent,
  CalendarStats,
  CalendarViewMode,
  Client,
} from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import {
  CalendarHeader,
  CalendarFilters,
  MonthView,
  WeekView,
  DayView,
  ListView,
  EventDetailModal,
  UpcomingEventsSidebar,
} from '../../components/calendar';
import { toast } from 'sonner';

export const EmployeeCalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [stats, setStats] = useState<CalendarStats>({
    total: 0,
    tasks: 0,
    content: 0,
    meetings: 0,
    renewals: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Assigned Clients for Employee filter
  const [clients, setClients] = useState<Client[]>([]);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Load employee's assigned clients
  useEffect(() => {
    const loadMyClients = async () => {
      try {
        const cRes = await clientService.getMyClients({ pageSize: 100 });
        setClients(cRes.data || []);
      } catch (err) {
        console.error('Error loading assigned clients:', err);
      }
    };
    loadMyClients();
  }, []);

  // Compute active date range for the current view
  const dateRangeBounds = useMemo(() => {
    let start: Date;
    let end: Date;

    if (viewMode === 'month') {
      const mStart = startOfMonth(currentDate);
      const mEnd = endOfMonth(mStart);
      start = startOfWeek(mStart, { weekStartsOn: 1 });
      end = endOfWeek(mEnd, { weekStartsOn: 1 });
    } else if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else if (viewMode === 'day') {
      start = startOfDay(currentDate);
      end = endOfDay(currentDate);
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(addMonths(currentDate, 1));
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [currentDate, viewMode]);

  // Fetch employee calendar events (backend enforces strict employee authorization)
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await calendarService.getEvents({
        startDate: dateRangeBounds.startDate,
        endDate: dateRangeBounds.endDate,
        clientId: selectedClientId || undefined,
        type: selectedType !== 'ALL' ? selectedType : undefined,
        search: searchQuery.trim() || undefined,
      });

      setEvents(res.events || []);
      setStats(res.stats || { total: 0, tasks: 0, content: 0, meetings: 0, renewals: 0 });
    } catch (err: any) {
      console.error('Failed to load employee calendar events', err);
      toast.error('Could not load your calendar activities');
    } finally {
      setIsLoading(false);
    }
  }, [dateRangeBounds, selectedClientId, selectedType, searchQuery]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate((d) => subMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else if (viewMode === 'day') setCurrentDate((d) => subDays(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate((d) => addMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else if (viewMode === 'day') setCurrentDate((d) => addDays(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Date title label for header
  const currentDateLabel = useMemo(() => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy');
    }
    if (viewMode === 'week') {
      const wStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const wEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(wStart, 'd MMM')} – ${format(wEnd, 'd MMM yyyy')}`;
    }
    if (viewMode === 'day') {
      return format(currentDate, 'd MMMM yyyy');
    }
    return format(currentDate, 'MMMM yyyy');
  }, [currentDate, viewMode]);

  // Clear filters
  const hasActiveFilters = Boolean(
    selectedType !== 'ALL' || selectedClientId || searchQuery
  );

  const handleClearFilters = () => {
    setSelectedType('ALL');
    setSelectedClientId('');
    setSearchQuery('');
  };

  // Event modal trigger
  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  };

  const handleSelectDay = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Work & Meeting Calendar"
        description="Your personal schedule for task delivery deadlines, client calls, and content publishing."
      />

      {/* Main Grid: Calendar Left & Summary Sidebar Right */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left Column: Calendar Header, Filters, Active View */}
        <div className="space-y-4">
          <CalendarHeader
            currentDateLabel={currentDateLabel}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
            onRefresh={loadEvents}
            isLoading={isLoading}
            isAdmin={false}
            onOpenAddModal={() => {}}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <CalendarFilters
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
            clients={clients}
            stats={stats}
            isAdmin={false}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <LoadingState message="Loading your schedule..." />
            </div>
          ) : (
            <>
              {viewMode === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  events={events}
                  onSelectEvent={handleSelectEvent}
                  onSelectDay={handleSelectDay}
                />
              )}

              {viewMode === 'week' && (
                <WeekView
                  currentDate={currentDate}
                  events={events}
                  onSelectEvent={handleSelectEvent}
                  onSelectDay={handleSelectDay}
                />
              )}

              {viewMode === 'day' && (
                <DayView
                  currentDate={currentDate}
                  events={events}
                  onSelectEvent={handleSelectEvent}
                />
              )}

              {viewMode === 'list' && (
                <ListView
                  events={events}
                  onSelectEvent={handleSelectEvent}
                  onClearFilters={handleClearFilters}
                  hasFilters={hasActiveFilters}
                />
              )}
            </>
          )}
        </div>

        {/* Right Column: Upcoming Sidebar */}
        <div className="space-y-4">
          <UpcomingEventsSidebar
            events={events}
            stats={stats}
            onSelectEvent={handleSelectEvent}
            isAdmin={false}
          />
        </div>
      </div>

      {/* Event Details Modal */}
      <EventDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        event={selectedEvent}
        isAdmin={false}
      />
    </div>
  );
};

export default EmployeeCalendarPage;
