import React, { useState, useEffect } from 'react';
import { auditService } from '../../services';
import { AuditLogItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDateTime } from '../../utils/formatters';
import { ShieldCheck, History } from 'lucide-react';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
} from '../../components/filters';

export const Settings: React.FC = () => {
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters } = useSmartFilters({
    action: '',
    resourceType: '',
    dateRange: '',
    startDate: '',
    endDate: '',
  });

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await auditService.listLogs({
        action: filters.action || undefined,
        resourceType: filters.resourceType || undefined,
        dateRange: filters.dateRange || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        pageSize: 100,
      });
      setLogs(res.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [filters.action, filters.resourceType, filters.dateRange, filters.startDate, filters.endDate]);

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.action) {
      list.push({ key: 'action', label: 'Action', value: filters.action });
    }
    if (filters.resourceType) {
      list.push({ key: 'resourceType', label: 'Resource', value: filters.resourceType });
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
  }, [filters]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dateRange') {
      setFilters({ dateRange: '', startDate: '', endDate: '' });
    } else {
      clearFilter(key);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading system audit logs..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs & System History"
        description="Immutable record of administrative actions, account changes, status activations, and payments."
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
        resultsLabel="audit logs"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
      >
        <SearchInput
          placeholder="Filter by action name..."
          value={filters.action}
          onChange={(val) => setFilter('action', val)}
          className="w-full sm:w-60"
        />

        <FilterSelect
          label="Resource Type"
          value={filters.resourceType}
          onChange={(val) => setFilter('resourceType', val)}
          options={[
            { label: 'Client', value: 'CLIENT' },
            { label: 'Task', value: 'TASK' },
            { label: 'Daily Report', value: 'DAILY_REPORT' },
            { label: 'Invoice', value: 'INVOICE' },
            { label: 'Payment', value: 'PAYMENT' },
            { label: 'User', value: 'USER' },
          ]}
        />
      </FilterToolbar>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">System Activity Ledger</h3>
          </div>
          <span className="text-xs text-slate-500">{logs.length} Total Audit Entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource Type</th>
                <th className="py-3 px-4">Resource ID</th>
                <th className="py-3 px-5 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-600">{formatDateTime(log.createdAt)}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {log.actorName || log.actor?.fullName || 'System Master'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{log.resourceType}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px] truncate max-w-xs">
                      {log.resourceId || '-'}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-slate-400 text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
