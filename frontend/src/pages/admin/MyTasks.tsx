import React, { useState, useEffect, useMemo } from 'react';
import { taskService, clientService } from '../../services';
import { Task, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate } from '../../utils/formatters';
import { CheckSquare, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
} from '../../components/filters';

export const MyTasks: React.FC = () => {
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters, activeFiltersCount } = useSmartFilters({
    search: '',
    status: '',
    priority: '',
    clientId: '',
    isOverdue: '',
    dateRange: '',
    dueDateFrom: '',
    dueDateTo: '',
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInitialData = async () => {
    try {
      const res = await clientService.listClients({ pageSize: 100 });
      setClients(res.data || []);
    } catch {
      // Handled
    }
  };

  const loadMyTasks = async () => {
    setIsLoading(true);
    try {
      const res = await taskService.getMyTasks({
        search: filters.search || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        clientId: filters.clientId || undefined,
        isOverdue: filters.isOverdue === 'true' ? true : undefined,
        dateRange: (filters.dateRange as any) || undefined,
        dueDateFrom: filters.dueDateFrom || undefined,
        dueDateTo: filters.dueDateTo || undefined,
        pageSize: 100,
      });
      setTasks(res.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadMyTasks();
  }, [
    filters.search,
    filters.status,
    filters.priority,
    filters.clientId,
    filters.isOverdue,
    filters.dateRange,
    filters.dueDateFrom,
    filters.dueDateTo,
  ]);

  const handleUpdateProgress = async (id: string, completionPercentage: number) => {
    try {
      const newStatus = completionPercentage === 100 ? 'COMPLETED' : 'IN_PROGRESS';
      await taskService.updateTaskStatus(id, { status: newStatus as any, completionPercentage });
      toast.success(`Progress set to ${completionPercentage}%`);
      loadMyTasks();
    } catch {
      // Handled
    }
  };

  const activeFilters = useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.clientId) {
      const c = clients.find((client) => client.id === filters.clientId);
      list.push({ key: 'clientId', label: 'Client', value: filters.clientId, displayValue: c?.companyName });
    }
    if (filters.status) list.push({ key: 'status', label: 'Status', value: filters.status });
    if (filters.priority) list.push({ key: 'priority', label: 'Priority', value: filters.priority });
    if (filters.isOverdue === 'true') {
      list.push({ key: 'isOverdue', label: 'Filter', value: 'Overdue Only' });
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
    } else if (filters.dueDateFrom || filters.dueDateTo) {
      list.push({
        key: 'dueDate',
        label: 'Due Date',
        value: `${filters.dueDateFrom || ''} to ${filters.dueDateTo || ''}`,
      });
    }
    return list;
  }, [filters, clients]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dateRange' || key === 'dueDate') {
      setFilters({ dateRange: '', dueDateFrom: '', dueDateTo: '' });
    } else {
      clearFilter(key);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assigned Tasks"
        description="Tasks assigned directly to you as an Admin worker. Submit progress milestones and complete deliverables."
      />

      {/* Unified Filter Toolbar */}
      <FilterToolbar
        dateFilter={
          <DateQuickFilter
            selectedPreset={filters.dateRange}
            startDate={filters.dueDateFrom}
            endDate={filters.dueDateTo}
            onChange={(preset, start, end) => {
              setFilters({
                dateRange: preset,
                dueDateFrom: start || '',
                dueDateTo: end || '',
              });
            }}
          />
        }
        totalResults={tasks.length}
        resultsLabel="tasks"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
      >
        <SearchInput
          placeholder="Search my tasks..."
          value={filters.search}
          onChange={(val) => setFilter('search', val)}
          className="w-full sm:w-60"
        />

        <FilterSelect
          label="Client"
          value={filters.clientId}
          onChange={(val) => setFilter('clientId', val)}
          options={clients.map((c) => ({ label: c.companyName, value: c.id }))}
        />

        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(val) => setFilter('status', val)}
          options={[
            { label: 'Assigned', value: 'ASSIGNED' },
            { label: 'In Progress', value: 'IN_PROGRESS' },
            { label: 'Internal Review', value: 'INTERNAL_REVIEW' },
            { label: 'Client Approval', value: 'CLIENT_APPROVAL' },
            { label: 'Approved', value: 'APPROVED' },
            { label: 'Completed', value: 'COMPLETED' },
          ]}
        />

        <FilterSelect
          label="Priority"
          value={filters.priority}
          onChange={(val) => setFilter('priority', val)}
          options={[
            { label: 'Low', value: 'LOW' },
            { label: 'Medium', value: 'MEDIUM' },
            { label: 'High', value: 'HIGH' },
            { label: 'Urgent', value: 'URGENT' },
          ]}
        />

        <label className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
          filters.isOverdue === 'true'
            ? 'bg-rose-100 text-rose-800 border-rose-300'
            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
        }`}>
          <input
            type="checkbox"
            checked={filters.isOverdue === 'true'}
            onChange={(e) => setFilter('isOverdue', e.target.checked ? 'true' : '')}
            className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
          />
          Overdue Only
        </label>
      </FilterToolbar>

      {isLoading ? (
        <LoadingState message="Loading your assigned tasks..." />
      ) : tasks.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-200 p-8">
          <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No tasks found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeFiltersCount > 0
              ? 'No assigned tasks match your active filters. Try resetting the filters.'
              : 'You currently have no tasks assigned to your account.'}
          </p>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-4">
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tasks.map((task) => (
            <Card key={task.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase">
                    {task.client?.companyName}
                  </span>
                  <StatusBadge status={task.status} />
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-2.5">{task.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description || 'No description'}</p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span className={task.isOverdue ? 'text-rose-600 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
                    <Clock className="w-3.5 h-3.5" /> Due {formatDate(task.dueDate)}
                  </span>
                  <span className="font-bold text-purple-700">{task.completionPercentage}%</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                  <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${task.completionPercentage}%` }} />
                </div>
              </div>

              {/* Fast Progress Updater */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Update:</span>
                <div className="flex items-center gap-1">
                  {[25, 50, 75, 100].map((step) => (
                    <button
                      key={step}
                      onClick={() => handleUpdateProgress(task.id, step)}
                      className={`px-2 py-1 text-[11px] font-bold rounded ${
                        task.completionPercentage === step
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {step}%
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

