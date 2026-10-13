import React, { useState, useEffect } from 'react';
import { meetingAndCommsService, clientService } from '../../services';
import { CommunicationLog, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDateTime } from '../../utils/formatters';
import { MessageSquare, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  FilterSelect,
  DateQuickFilter,
} from '../../components/filters';

export const Communications: React.FC = () => {
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters } = useSmartFilters({
    clientId: '',
    dateRange: '',
    startDate: '',
    endDate: '',
  });

  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    type: 'WHATSAPP' as any,
    summary: '',
    clientRequirements: '',
    nextAction: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [comms, clientRes] = await Promise.all([
        meetingAndCommsService.listCommunications({
          clientId: filters.clientId || undefined,
          dateRange: filters.dateRange || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        }),
        clientService.listClients({ pageSize: 100 }),
      ]);
      setLogs(comms || []);
      setClients(clientRes.data || []);
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
      await meetingAndCommsService.createCommunication(formData);
      toast.success('Communication logged');
      setIsModalOpen(false);
      setFormData({
        clientId: '',
        type: 'WHATSAPP',
        summary: '',
        clientRequirements: '',
        nextAction: '',
      });
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading communication logs..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Communications Log"
        description="Log WhatsApp interactions, emails, phone calls, and next follow-up actions."
        actions={
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Log Interaction
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
        totalResults={logs.length}
        resultsLabel="interactions"
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

      <div className="space-y-3">
        {logs.map((log) => (
          <Card key={log.id} className="p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-purple-100 text-purple-700 uppercase">
                  {log.type}
                </span>
                <span className="font-bold text-slate-900 text-xs">{log.client?.companyName}</span>
              </div>
              <span className="text-[10px] text-slate-400">{formatDateTime(log.date)}</span>
            </div>

            <p className="text-xs text-slate-700 mt-2 leading-relaxed">{log.summary}</p>

            {log.nextAction && (
              <p className="text-[11px] text-purple-700 font-semibold mt-2 pt-2 border-t border-slate-100">
                Next Action: {log.nextAction}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Log Interaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Client Communication"
        description="Record details from client discussions across WhatsApp, phone, or email"
        maxWidth="md"
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

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Communication Channel</label>
            <select
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PHONE">Phone Call</option>
              <option value="EMAIL">Email</option>
              <option value="MEETING">In-person Meeting</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <Textarea
            label="Summary of Conversation *"
            placeholder="Key discussion points, feedback, requests..."
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            required
          />

          <Input
            label="Next Actionable Step"
            placeholder="e.g. Send revised reel draft by tomorrow 4 PM"
            value={formData.nextAction}
            onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Save Log
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

