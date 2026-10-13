import React, { useState, useEffect } from 'react';
import { meetingAndCommsService, clientService, userService } from '../../services';
import { Meeting, Client, User } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { Video, Plus, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
} from '../../components/filters';

export const Meetings: React.FC = () => {
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters } = useSmartFilters({
    clientId: '',
    dateRange: '',
    startDate: '',
    endDate: '',
  });

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    title: '',
    meetingDateTime: '',
    meetingLink: '',
    agenda: '',
    actionItems: '',
    participantIds: [] as string[],
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mRes, cRes, uRes] = await Promise.all([
        meetingAndCommsService.listMeetings({
          clientId: filters.clientId || undefined,
          dateRange: filters.dateRange || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        }),
        clientService.listClients({ pageSize: 100 }),
        userService.listUsers({ pageSize: 100 }),
      ]);
      setMeetings(mRes || []);
      setClients(cRes.data || []);
      setUsers(uRes.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.clientId, filters.dateRange, filters.startDate, filters.endDate]);

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.clientId) {
      const c = clients.find((client) => client.id === filters.clientId);
      list.push({ key: 'clientId', label: 'Client', value: filters.clientId, displayValue: c?.companyName });
    }
    if (filters.dateRange) {
      const presetLabels: Record<string, string> = {
        today: 'Today',
        yesterday: 'Yesterday',
        thisWeek: 'This Week',
        thisMonth: 'This Month',
        thisQuarter: 'This Quarter',
        thisYear: 'This Year',
        custom: 'Custom Range',
      };
      list.push({
        key: 'dateRange',
        label: 'Timeline',
        value: presetLabels[filters.dateRange] || filters.dateRange,
      });
    } else if (filters.startDate || filters.endDate) {
      list.push({
        key: 'dateRange',
        label: 'Date Range',
        value: `${filters.startDate || ''} to ${filters.endDate || ''}`,
      });
    }
    return list;
  }, [filters, clients]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dateRange') {
      setFilters({ dateRange: '', startDate: '', endDate: '' });
    } else {
      clearFilter(key);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await meetingAndCommsService.createMeeting(formData);
      toast.success('Meeting scheduled');
      setIsModalOpen(false);
      setFormData({
        clientId: '',
        title: '',
        meetingDateTime: '',
        meetingLink: '',
        agenda: '',
        actionItems: '',
        participantIds: [],
      });
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading meetings..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Meetings & Minutes"
        description="Schedule client strategy calls, record minutes, and convert action items into tasks."
        actions={
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Schedule Meeting
          </Button>
        }
      />

      {/* Unified Filter Toolbar */}
      <FilterToolbar
        dateFilter={
          <DateQuickFilter
            selectedPreset={filters.dateRange}
            startDate={filters.startDate}
            endDate={filters.endDate}
            onChange={(preset, start, end) => {
              setFilters({
                dateRange: preset,
                startDate: start || '',
                endDate: end || '',
              });
            }}
          />
        }
        totalResults={meetings.length}
        resultsLabel="meetings"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
      >
        <FilterSelect
          label="Client"
          value={filters.clientId}
          onChange={(val) => setFilter('clientId', val)}
          options={clients.map((c) => ({ label: c.companyName, value: c.id }))}
        />
      </FilterToolbar>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {meetings.map((m) => (
          <Card key={m.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase">
                {m.client?.companyName}
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-2">{m.title}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {formatDateTime(m.meetingDateTime)}
              </p>

              {m.agenda && (
                <div className="mt-3 p-2.5 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-100">
                  <span className="font-semibold block text-[10px] text-slate-400">Agenda:</span>
                  {m.agenda}
                </div>
              )}

              {m.actionItems && (
                <div className="mt-2 p-2.5 bg-purple-50/50 rounded-lg text-xs text-purple-900 border border-purple-100">
                  <span className="font-semibold block text-[10px] text-purple-600">Action Items:</span>
                  {m.actionItems}
                </div>
              )}
            </div>

            {m.meetingLink && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <a
                  href={m.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700"
                >
                  <LinkIcon className="w-3.5 h-3.5" /> Join Call Link
                </a>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Schedule Meeting Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Client Meeting"
        description="Book a client strategy call and invite team participants"
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Client *</label>
            <select
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              required
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Meeting Title *"
            placeholder="e.g. Monthly Performance & Campaign Strategy Review"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Meeting Date & Time *"
              type="datetime-local"
              value={formData.meetingDateTime}
              onChange={(e) => setFormData({ ...formData, meetingDateTime: e.target.value })}
              required
            />
            <Input
              label="Meeting URL (Google Meet / Zoom)"
              placeholder="https://meet.google.com/xyz"
              value={formData.meetingLink}
              onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
            />
          </div>

          <Textarea
            label="Meeting Agenda & Discussion Points"
            placeholder="Key discussion topics..."
            value={formData.agenda}
            onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
          />

          <Textarea
            label="Action Items (Follow-up Tasks)"
            placeholder="Deliverables agreed upon during call..."
            value={formData.actionItems}
            onChange={(e) => setFormData({ ...formData, actionItems: e.target.value })}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Schedule Meeting
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

