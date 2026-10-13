import React, { useState, useEffect } from 'react';
import { financeService } from '../../services';
import { Renewal } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { formatINR, formatDate } from '../../utils/formatters';
import { RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
} from '../../components/filters';

export const Renewals: React.FC = () => {
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters, activeFiltersCount } =
    useSmartFilters({
      window: 'all',
      search: '',
      status: '',
      dateRange: '',
      renewalDateFrom: '',
      renewalDateTo: '',
    });

  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    renewalDate: '',
    renewalAmount: 0,
    renewalStatus: 'RENEWED' as any,
    notes: '',
  });

  const loadRenewals = async () => {
    setIsLoading(true);
    try {
      const data = await financeService.listRenewals({
        window: filters.window !== 'all' ? filters.window : undefined,
        search: filters.search || undefined,
        status: filters.status || undefined,
        dateRange: (filters.dateRange as any) || undefined,
        renewalDateFrom: filters.renewalDateFrom || undefined,
        renewalDateTo: filters.renewalDateTo || undefined,
      });
      setRenewals(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRenewals();
  }, [
    filters.window,
    filters.search,
    filters.status,
    filters.dateRange,
    filters.renewalDateFrom,
    filters.renewalDateTo,
  ]);

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.window && filters.window !== 'all') {
      const windowLabels: Record<string, string> = {
        '7days': '7 Days Alert',
        '30days': '30 Days Alert',
        overdue: 'Overdue',
        due: 'Due Soon',
      };
      list.push({ key: 'window', label: 'Window', value: windowLabels[filters.window] || filters.window });
    }
    if (filters.status) list.push({ key: 'status', label: 'Status', value: filters.status });
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
    } else if (filters.renewalDateFrom || filters.renewalDateTo) {
      list.push({
        key: 'renewalDate',
        label: 'Renewal Date',
        value: `${filters.renewalDateFrom || ''} to ${filters.renewalDateTo || ''}`,
      });
    }
    return list;
  }, [filters]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dateRange' || key === 'renewalDate') {
      setFilters({ dateRange: '', renewalDateFrom: '', renewalDateTo: '' });
    } else if (key === 'window') {
      setFilter('window', 'all');
    } else {
      clearFilter(key);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRenewal) return;
    setIsSubmitting(true);
    try {
      await financeService.updateRenewal(selectedRenewal.id, {
        renewalDate: form.renewalDate,
        renewalAmount: Number(form.renewalAmount),
        renewalStatus: form.renewalStatus,
        notes: form.notes,
      });
      toast.success('Renewal record updated');
      setSelectedRenewal(null);
      loadRenewals();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Contract Renewals & Alerts"
        description="Automated 30-day and 7-day contract expiration tracking to prevent client churn."
      />

      {/* Quick Alert Windows Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'all', label: 'All Contracts' },
          { key: '7days', label: '⚠️ Due in 7 Days (Critical)' },
          { key: '30days', label: '📅 Due in 30 Days (Upcoming)' },
          { key: 'overdue', label: '🚨 Overdue Expired' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter('window', tab.key)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              (filters.window || 'all') === tab.key
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Unified Filter Toolbar */}
      <FilterToolbar
        dateFilter={
          <DateQuickFilter
            selectedPreset={filters.dateRange}
            startDate={filters.renewalDateFrom}
            endDate={filters.renewalDateTo}
            onChange={(preset, start, end) => {
              setFilters({
                dateRange: preset,
                renewalDateFrom: start || '',
                renewalDateTo: end || '',
              });
            }}
          />
        }
        totalResults={renewals.length}
        resultsLabel="renewal records"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
      >
        <SearchInput
          placeholder="Search client, contact person, email..."
          value={filters.search}
          onChange={(val) => setFilter('search', val)}
          className="w-full sm:w-72"
        />

        <FilterSelect
          label="Renewal Status"
          value={filters.status}
          onChange={(val) => setFilter('status', val)}
          options={[
            { label: 'Upcoming', value: 'UPCOMING' },
            { label: 'Due (In Negotiation)', value: 'DUE' },
            { label: 'Renewed', value: 'RENEWED' },
            { label: 'Churned', value: 'CHURNED' },
          ]}
        />
      </FilterToolbar>

      {isLoading ? (
        <LoadingState message="Loading client renewal lifecycles..." />
      ) : renewals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No renewals match your filter criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search terms or switching between alert window tabs.
          </p>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Reset All Filters
            </Button>
          )}
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-5">Client</th>
                <th className="py-3 px-4">Contract Period</th>
                <th className="py-3 px-4">Renewal Date</th>
                <th className="py-3 px-4">Retainer Amount</th>
                <th className="py-3 px-4">Time Left / Alert</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {renewals.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-5">
                    <p className="font-bold text-slate-900">{r.client?.companyName}</p>
                    <p className="text-[11px] text-slate-500">{r.client?.contactPerson}</p>
                  </td>

                  <td className="py-3.5 px-4 text-slate-600">
                    {formatDate(r.contractStartDate)} — {formatDate(r.contractEndDate)}
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-900">{formatDate(r.renewalDate)}</td>

                  <td className="py-3.5 px-4 font-bold text-purple-700">{formatINR(r.renewalAmount)}</td>

                  <td className="py-3.5 px-4">
                    {r.isOverdue ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    ) : r.isDueSoon ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                        <Clock className="w-3 h-3" /> Due in {r.daysUntilRenewal} days
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium">{r.daysUntilRenewal} days</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <StatusBadge status={r.renewalStatus} />
                  </td>

                  <td className="py-3.5 px-5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRenewal(r);
                        setForm({
                          renewalDate: new Date(r.renewalDate).toISOString().slice(0, 10),
                          renewalAmount: r.renewalAmount,
                          renewalStatus: r.renewalStatus,
                          notes: r.notes || '',
                        });
                      }}
                      className="text-xs"
                    >
                      Update
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* Update Renewal Modal */}
      {selectedRenewal && (
        <Modal
          isOpen={Boolean(selectedRenewal)}
          onClose={() => setSelectedRenewal(null)}
          title={`Update Contract Renewal — ${selectedRenewal.client?.companyName}`}
          description="Record contract renewal extension or update status"
          maxWidth="md"
        >
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Renewal Status *</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                value={form.renewalStatus}
                onChange={(e) => setForm({ ...form, renewalStatus: e.target.value as any })}
              >
                <option value="RENEWED">Renewed (Extended Contract)</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="DUE">Due (In Negotiation)</option>
                <option value="CHURNED">Churned (Not Renewing)</option>
              </select>
            </div>

            <Input
              label="Next Renewal Date *"
              type="date"
              value={form.renewalDate}
              onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
              required
            />

            <Input
              label="Renewal Retainer Amount (₹ INR) *"
              type="number"
              value={form.renewalAmount}
              onChange={(e) => setForm({ ...form, renewalAmount: Number(e.target.value) })}
              required
            />

            <Textarea
              label="Notes & Negotiation History"
              placeholder="Terms, discounts, or feedback discussed with client..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedRenewal(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                Save Renewal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

