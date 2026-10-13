import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { taskService, clientService } from '../../services';
import { Task, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatDateTime } from '../../utils/formatters';
import {
  CheckSquare,
  Clock,
  MessageSquare,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Send,
  Paperclip,
  UserCheck,
  Briefcase,
  Layers,
  Calendar,
  RefreshCw,
  LayoutGrid,
  List,
  Sparkles,
  FileText,
  ExternalLink,
  ShieldCheck,
  Play,
  SlidersHorizontal,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
} from '../../components/filters';

const MILESTONE_STEPS = [0, 25, 50, 75, 100] as const;

const MILESTONE_LABELS: Record<number, string> = {
  0: 'Started (0%)',
  25: 'Initial Progress',
  50: 'Halfway Complete',
  75: 'Near Completion',
  100: 'Ready for Review',
};

const isTaskNotStarted = (status: string) =>
  ['CREATED', 'ASSIGNED'].includes(status);

const isTaskLocked = (status: string) =>
  ['APPROVED', 'DELIVERED', 'COMPLETED'].includes(status);

const isTaskInReview = (status: string) =>
  ['INTERNAL_REVIEW', 'CLIENT_APPROVAL'].includes(status);

const getTaskStatusLabel = (status: string): string => {
  switch (status) {
    case 'CREATED':
    case 'ASSIGNED':
      return 'Not Started';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'REVISION_REQUIRED':
      return 'Changes Requested';
    case 'INTERNAL_REVIEW':
    case 'CLIENT_APPROVAL':
      return 'Pending Review';
    case 'APPROVED':
    case 'DELIVERED':
    case 'COMPLETED':
      return 'Completed';
    default:
      return status.replace(/_/g, ' ');
  }
};

const getRelativeDueLabel = (dueDateStr: string, status: string) => {
  if (isTaskLocked(status)) {
    return { text: 'Completed', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  const now = new Date();
  const due = new Date(dueDateStr);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      text: overdueDays === 1 ? 'Overdue by 1 day' : `Overdue by ${overdueDays} days`,
      tone: 'text-rose-700 bg-rose-50 border-rose-200',
    };
  }
  if (diffDays === 0) {
    return { text: 'Due Today', tone: 'text-amber-700 bg-amber-200 border-amber-200' };
  }
  if (diffDays === 1) {
    return { text: 'Due Tomorrow', tone: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  return {
    text: `${diffDays} days remaining`,
    tone: 'text-slate-600 bg-slate-100 border-slate-200',
  };
};

export const MyTasks: React.FC = () => {
  const queryClient = useQueryClient();

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  const invalidateTaskCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const loadInitialData = async () => {
    try {
      const res = await clientService.getMyClients({ pageSize: 100 });
      setClients(res.data || []);
    } catch {
      // Handled by global interceptor
    }
  };

  const loadTasks = async () => {
    setIsLoading(true);
    setLoadError(null);
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
      const fetched: Task[] = res.data || [];
      setTasks(fetched);
      if (selectedTask) {
        const refreshed = fetched.find((t: Task) => t.id === selectedTask.id);
        if (refreshed) {
          setSelectedTask((prev) => (prev ? { ...prev, ...refreshed } : null));
        }
      }
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Unable to load your assigned tasks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTasks();
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

  const activeFilters = useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.clientId) {
      const c = clients.find((client) => client.id === filters.clientId);
      list.push({ key: 'clientId', label: 'Client', value: filters.clientId, displayValue: c?.companyName });
    }
    if (filters.status) {
      list.push({
        key: 'status',
        label: 'Status',
        value: filters.status,
        displayValue: getTaskStatusLabel(filters.status),
      });
    }
    if (filters.priority) list.push({ key: 'priority', label: 'Priority', value: filters.priority });
    if (filters.dateRange) {
      const labels: Record<string, string> = {
        today: 'Today',
        yesterday: 'Yesterday',
        thisWeek: 'This Week',
        thisMonth: 'This Month',
        thisQuarter: 'This Quarter',
        thisYear: 'This Year',
        custom: 'Custom Range',
      };
      list.push({ key: 'dateRange', label: 'Timeline', value: labels[filters.dateRange] || filters.dateRange });
    }
    if (filters.dueDateFrom || filters.dueDateTo) {
      list.push({
        key: 'dueDate',
        label: 'Date Range',
        value: `${filters.dueDateFrom || '...'} to ${filters.dueDateTo || '...'}`,
      });
    }
    if (filters.isOverdue === 'true') {
      list.push({ key: 'isOverdue', label: 'Filter', value: 'Overdue Only' });
    }
    return list;
  }, [filters, clients]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dueDate' || key === 'dateRange') {
      setFilters({ dateRange: '', dueDateFrom: '', dueDateTo: '' });
    } else {
      clearFilter(key);
    }
  };

  // Summary metrics derived from loaded tasks
  const taskStats = useMemo(() => {
    const notStarted = tasks.filter((t) => isTaskNotStarted(t.status)).length;
    const inProgress = tasks.filter((t) => ['IN_PROGRESS', 'REVISION_REQUIRED'].includes(t.status)).length;
    const inReview = tasks.filter((t) => isTaskInReview(t.status)).length;
    const completed = tasks.filter((t) => isTaskLocked(t.status)).length;
    const overdue = tasks.filter((t) => t.isOverdue).length;
    return { notStarted, inProgress, inReview, completed, overdue };
  }, [tasks]);

  /**
   * Open task details modal and fetch full task details (comments & attachments)
   */
  const handleOpenTaskDetails = async (task: Task, focusComment = false) => {
    setSelectedTask(task);
    try {
      const fullTask = await taskService.getTaskById(task.id);
      setSelectedTask(fullTask);
    } catch {
      // Keep list task data if detail fetch fails
    }
    if (focusComment) {
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 150);
    }
  };

  /**
   * Start an assigned task: transitions Not Started (ASSIGNED/CREATED) -> IN_PROGRESS at 0%,
   * records startedAt & startedById on the backend, and unlocks milestone progress buttons.
   */
  const handleStartTask = async (task: Task) => {
    if (!isTaskNotStarted(task.status)) return;
    setStartingTaskId(task.id);
    try {
      const started = await taskService.startTask(task.id);
      toast.success(`Started "${task.title}"! You can now update your milestone progress.`);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...started } : t)));
      if (selectedTask?.id === task.id) {
        setSelectedTask((prev) => (prev ? { ...prev, ...started } : started));
      }
      invalidateTaskCaches();
    } catch {
      // Handled by global interceptor
    } finally {
      setStartingTaskId(null);
    }
  };

  /**
   * Update progress milestone (0%, 25%, 50%, 75%, 100%).
   * Requires the task to be started first.
   * Preserves review/approval workflow: reaching 100% keeps task IN_PROGRESS
   * until the employee explicitly submits it for review.
   */
  const handleUpdateProgress = async (task: Task, percentage: number) => {
    if (isTaskNotStarted(task.status)) {
      toast.error('Please click "Start Task" first before updating progress.');
      return;
    }
    if (isTaskLocked(task.status)) {
      toast.info('This task has already been approved and completed.');
      return;
    }

    setUpdatingTaskId(task.id);
    try {
      const updated = await taskService.updateTaskStatus(task.id, {
        status: 'IN_PROGRESS' as any,
        completionPercentage: percentage,
      });

      if (percentage === 100) {
        toast.success('Progress updated to 100%! Click "Submit for Review" when ready for Admin approval.');
      } else {
        toast.success(`Task progress updated to ${percentage}%`);
      }

      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)));
      if (selectedTask?.id === task.id) {
        setSelectedTask((prev) => (prev ? { ...prev, ...updated } : updated));
      }
      invalidateTaskCaches();
    } catch {
      // Handled by global interceptor
    } finally {
      setUpdatingTaskId(null);
    }
  };

  /**
   * Explicitly submit task to INTERNAL_REVIEW (Pending Review) when progress reaches 100%
   */
  const handleSubmitForReview = async (task: Task) => {
    if (isTaskNotStarted(task.status)) {
      toast.error('Please start the task and complete your work before submitting for review.');
      return;
    }
    if (task.completionPercentage < 100) {
      toast.error('Please update task progress to 100% before submitting for review.');
      return;
    }
    if (isTaskLocked(task.status)) return;

    setUpdatingTaskId(task.id);
    try {
      const updated = await taskService.updateTaskStatus(task.id, {
        status: 'INTERNAL_REVIEW' as any,
        completionPercentage: 100,
        comment: 'Submitted task deliverables for review (100% complete).',
      });
      toast.success('Task submitted for review! Status is now Pending Review.');
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)));
      if (selectedTask?.id === task.id) {
        const refreshed = await taskService.getTaskById(task.id).catch(() => updated);
        setSelectedTask(refreshed);
      }
      invalidateTaskCaches();
    } catch {
      // Handled
    } finally {
      setUpdatingTaskId(null);
    }
  };

  /**
   * Add a work note / discussion comment
   */
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !commentText.trim()) return;
    setIsPostingComment(true);
    try {
      const comment = await taskService.addComment(selectedTask.id, commentText.trim());
      const nextComments = [...(selectedTask.comments || []), comment];
      setSelectedTask({
        ...selectedTask,
        comments: nextComments,
        _count: {
          comments: nextComments.length,
          attachments: selectedTask._count?.attachments ?? (selectedTask.attachments?.length || 0),
        },
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id
            ? {
                ...t,
                comments: nextComments,
                _count: {
                  comments: nextComments.length,
                  attachments: t._count?.attachments ?? (t.attachments?.length || 0),
                },
              }
            : t
        )
      );
      setCommentText('');
      toast.success('Work note posted');
      invalidateTaskCaches();
    } catch {
      // Handled
    } finally {
      setIsPostingComment(false);
    }
  };

  /**
   * Upload proof / deliverable attachment
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const attachment = await taskService.addAttachment(selectedTask.id, formData);
      const nextAttachments = [attachment, ...(selectedTask.attachments || [])];
      setSelectedTask({
        ...selectedTask,
        attachments: nextAttachments,
        _count: {
          comments: selectedTask._count?.comments ?? (selectedTask.comments?.length || 0),
          attachments: nextAttachments.length,
        },
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id
            ? {
                ...t,
                attachments: nextAttachments,
                _count: {
                  comments: t._count?.comments ?? (t.comments?.length || 0),
                  attachments: nextAttachments.length,
                },
              }
            : t
        )
      );
      toast.success(`Uploaded proof: ${file.name}`);
      invalidateTaskCaches();
    } catch {
      // Handled
    } finally {
      setIsUploadingFile(false);
      if (modalFileInputRef.current) {
        modalFileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tasks & Deliverables"
        description="Start newly assigned tasks, update milestone progress (25% → 100%), upload proof of work, and submit completed tasks for review."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Detailed Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Table View
              </button>
            </div>
          </div>
        }
      />

      {/* Task Workspace Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setFilters({ status: filters.status === 'ASSIGNED' ? '' : 'ASSIGNED', isOverdue: '' })}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filters.status === 'ASSIGNED'
              ? 'bg-purple-50/80 border-purple-300 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-purple-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Not Started</span>
            <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Play className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1.5">{taskStats.notStarted}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Ready to start (0%)</p>
        </div>

        <div
          onClick={() => setFilters({ status: filters.status === 'IN_PROGRESS' ? '' : 'IN_PROGRESS', isOverdue: '' })}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filters.status === 'IN_PROGRESS'
              ? 'bg-blue-50/80 border-blue-200 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">In Progress</span>
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1.5">{taskStats.inProgress}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Active execution</p>
        </div>

        <div
          onClick={() => setFilters({ status: filters.status === 'INTERNAL_REVIEW' ? '' : 'INTERNAL_REVIEW', isOverdue: '' })}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filters.status === 'INTERNAL_REVIEW'
              ? 'bg-amber-50/80 border-amber-200 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Review</span>
            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1.5">{taskStats.inReview}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Awaiting approval</p>
        </div>

        <div
          onClick={() => setFilters({ status: filters.status === 'COMPLETED' ? '' : 'COMPLETED', isOverdue: '' })}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filters.status === 'COMPLETED'
              ? 'bg-emerald-50/80 border-emerald-200 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Completed</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1.5">{taskStats.completed}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Approved deliverables</p>
        </div>

        <div
          onClick={() => setFilter('isOverdue', filters.isOverdue === 'true' ? '' : 'true')}
          className={`p-4 rounded-xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            filters.isOverdue === 'true'
              ? 'bg-rose-50 border-rose-300 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Overdue</span>
            <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-1.5">{taskStats.overdue}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Needs immediate focus</p>
        </div>
      </div>

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
          className="w-full sm:w-56"
        />

        <FilterSelect
          label="Client"
          value={filters.clientId}
          onChange={(val) => setFilter('clientId', val)}
          options={[
            { label: 'All Assigned Clients', value: '' },
            ...clients.map((c) => ({ label: c.companyName, value: c.id })),
          ]}
        />

        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(val) => setFilter('status', val)}
          options={[
            { label: 'All Statuses', value: '' },
            { label: 'Not Started', value: 'ASSIGNED' },
            { label: 'In Progress', value: 'IN_PROGRESS' },
            { label: 'Changes Requested', value: 'REVISION_REQUIRED' },
            { label: 'Pending Review', value: 'INTERNAL_REVIEW' },
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
            { label: 'All Priorities', value: '' },
            { label: 'Low', value: 'LOW' },
            { label: 'Medium', value: 'MEDIUM' },
            { label: 'High', value: 'HIGH' },
            { label: 'Urgent', value: 'URGENT' },
          ]}
        />

        <label
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
            filters.isOverdue === 'true'
              ? 'bg-rose-100 text-rose-800 border-rose-300'
              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
          }`}
        >
          <input
            type="checkbox"
            checked={filters.isOverdue === 'true'}
            onChange={(e) => setFilter('isOverdue', e.target.checked ? 'true' : '')}
            className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
          />
          Overdue Only
        </label>
      </FilterToolbar>

      {/* Loading Skeleton State */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((skeletonIdx) => (
            <div
              key={skeletonIdx}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-28 bg-slate-200 rounded-md" />
                  <div className="h-5 w-32 bg-slate-100 rounded-md" />
                </div>
                <div className="h-6 w-24 bg-slate-200 rounded-full" />
              </div>
              <div className="h-6 w-2/3 bg-slate-200 rounded-md" />
              <div className="h-4 w-full bg-slate-100 rounded-md" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        /* Error State with Retry */
        <div className="py-12 text-center bg-white rounded-2xl border border-rose-200 p-8 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Failed to load tasks</h3>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{loadError}</p>
          <Button variant="primary" size="sm" onClick={loadTasks} className="mt-4">
            <RefreshCw className="w-4 h-4" />
            Retry Loading Tasks
          </Button>
        </div>
      ) : tasks.length === 0 ? (
        /* Empty State */
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {activeFiltersCount > 0 ? 'No matching tasks found' : 'No tasks assigned yet.'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {activeFiltersCount > 0
              ? 'No assigned tasks match your current filter selection. Try clearing or adjusting your active filters.'
              : 'Your Admin will assign tasks when work is ready.'}
          </p>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-4">
              Reset Filters
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View Mode */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Task & Deliverable</th>
                  <th className="py-3.5 px-4">Client & Service</th>
                  <th className="py-3.5 px-4">Priority & Status</th>
                  <th className="py-3.5 px-4">Timeline & Started</th>
                  <th className="py-3.5 px-4">Milestone Progress</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {tasks.map((task) => {
                  const notStarted = isTaskNotStarted(task.status);
                  const locked = isTaskLocked(task.status);
                  const inReview = isTaskInReview(task.status);
                  const dueInfo = getRelativeDueLabel(task.dueDate, task.status);
                  const commentCount = task._count?.comments ?? task.comments?.length ?? 0;
                  const attachmentCount = task._count?.attachments ?? task.attachments?.length ?? 0;

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono font-semibold text-slate-400">
                            #TSK-{task.id.slice(-5).toUpperCase()}
                          </span>
                          {commentCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              <MessageSquare className="w-3 h-3" /> {commentCount}
                            </span>
                          )}
                          {attachmentCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                              <Paperclip className="w-3 h-3" /> {attachmentCount}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenTaskDetails(task)}
                          className="text-sm font-bold text-slate-900 hover:text-purple-600 text-left transition-colors line-clamp-1"
                        >
                          {task.title}
                        </button>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {task.description || 'No specific task instructions provided.'}
                        </p>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700">
                            <Briefcase className="w-3.5 h-3.5 shrink-0" />
                            {task.client?.companyName || 'Assigned Client'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                            <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                            {task.service?.name || 'General Deliverable'}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={task.status} label={getTaskStatusLabel(task.status)} />
                          <StatusBadge status={task.priority} />
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`font-semibold flex items-center gap-1 ${
                              task.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Due {formatDate(task.dueDate)}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border w-fit ${dueInfo.tone}`}>
                            {dueInfo.text}
                          </span>
                          {task.startedAt && (
                            <span className="text-[10px] text-slate-500">
                              Started: {formatDateTime(task.startedAt)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 min-w-[230px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-600">
                            {notStarted
                              ? 'Not Started'
                              : MILESTONE_LABELS[task.completionPercentage] || 'In Progress'}
                          </span>
                          <span className="font-bold text-purple-700">{task.completionPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              locked ? 'bg-emerald-500' : 'bg-purple-600'
                            }`}
                            style={{ width: `${task.completionPercentage}%` }}
                          />
                        </div>
                        {notStarted ? (
                          <span className="text-[10px] text-slate-400 italic">
                            Click Start Task to unlock progress
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            {MILESTONE_STEPS.map((step) => (
                              <button
                                key={step}
                                type="button"
                                disabled={locked || inReview || updatingTaskId === task.id}
                                onClick={() => handleUpdateProgress(task, step)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                                  task.completionPercentage === step
                                    ? 'bg-purple-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {step}%
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenTaskDetails(task)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Details
                          </Button>
                          {notStarted ? (
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={startingTaskId === task.id}
                              onClick={() => handleStartTask(task)}
                            >
                              <Play className="w-3.5 h-3.5" />
                              Start Task
                            </Button>
                          ) : !locked && !inReview && task.completionPercentage === 100 ? (
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={updatingTaskId === task.id}
                              onClick={() => handleSubmitForReview(task)}
                            >
                              <Send className="w-3.5 h-3.5" />
                              Submit for Review
                            </Button>
                          ) : !locked && !inReview ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenTaskDetails(task)}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              Update Progress
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detailed Cards View Mode — Full-width rich workspace when 1 task, 2-column balanced grid when multiple */
        <div className={tasks.length === 1 ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 xl:grid-cols-2 gap-5'}>
          {tasks.map((task) => {
            const notStarted = isTaskNotStarted(task.status);
            const locked = isTaskLocked(task.status);
            const inReview = isTaskInReview(task.status);
            const dueInfo = getRelativeDueLabel(task.dueDate, task.status);
            const commentCount = task._count?.comments ?? task.comments?.length ?? 0;
            const attachmentCount = task._count?.attachments ?? task.attachments?.length ?? 0;
            const isSingleTaskView = tasks.length === 1;

            return (
              <Card
                key={task.id}
                className="p-0 overflow-hidden border border-slate-200/90 hover:border-purple-200 hover:shadow-md transition-all"
              >
                {/* Top Card Banner Strip */}
                <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-100/80 border border-purple-200 px-2.5 py-1 rounded-lg">
                      <Briefcase className="w-3.5 h-3.5" />
                      {task.client?.companyName || 'Assigned Client'}
                    </span>

                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      {task.service?.name || 'General Service'}
                    </span>

                    {task.deliverableName ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                        <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                        Deliverable: {task.deliverableName} ({task.deliverableCount || 1})
                      </span>
                    ) : task.deliverableCount === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                        General Task
                      </span>
                    ) : null}

                    <span className="text-[11px] font-mono font-semibold text-slate-400 px-1.5">
                      #TSK-{task.id.slice(-6).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={task.priority} />
                    <StatusBadge status={task.status} label={getTaskStatusLabel(task.status)} />
                  </div>
                </div>

                {/* Main Card Body — Responsive 2-column split when single task, structured stack when multiple */}
                <div
                  className={
                    isSingleTaskView
                      ? 'p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
                      : 'p-6 flex flex-col justify-between gap-5'
                  }
                >
                  {/* Left / Primary Task Information Column */}
                  <div className={isSingleTaskView ? 'lg:col-span-7 space-y-4' : 'space-y-4'}>
                    <div>
                      <h3
                        onClick={() => handleOpenTaskDetails(task)}
                        className="text-lg font-bold text-slate-900 hover:text-purple-600 cursor-pointer transition-colors leading-snug"
                      >
                        {task.title}
                      </h3>
                      <p
                        className={`text-xs text-slate-600 mt-2 leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 ${
                          isSingleTaskView ? '' : 'line-clamp-3'
                        }`}
                      >
                        {task.description ||
                          'No additional task instructions provided. Use the work notes section to share deliverable links or updates with your reviewer.'}
                      </p>
                    </div>

                    {/* Rich Operational Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Due Date
                        </span>
                        <span
                          className={`text-xs font-bold mt-0.5 flex items-center gap-1 ${
                            task.isOverdue ? 'text-rose-600' : 'text-slate-800'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          {formatDate(task.dueDate)}
                        </span>
                        <span
                          className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${dueInfo.tone}`}
                        >
                          {dueInfo.text}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Start Date & Time
                        </span>
                        {notStarted ? (
                          <>
                            <span className="text-xs font-bold text-slate-500 mt-0.5 block">
                              Not Started
                            </span>
                            <span className="text-[10px] text-purple-700 font-semibold mt-1 block">
                              Awaiting start
                            </span>
                          </>
                        ) : task.startedAt ? (
                          <>
                            <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">
                              {formatDateTime(task.startedAt)}
                            </span>
                            <span className="text-[10px] text-slate-500 mt-1 block truncate">
                              By {task.startedBy?.fullName || task.assignedTo?.fullName || 'Assignee'}
                            </span>
                          </>
                        ) : (task.status === 'COMPLETED' || task.status === 'APPROVED' || task.status === 'DELIVERED' || task.completionPercentage === 100) ? (
                          <>
                            <span className="text-xs font-bold text-emerald-700 mt-0.5 block truncate">
                              Completed (Legacy Record)
                            </span>
                            <span className="text-[10px] text-slate-500 mt-1 block truncate">
                              Created {formatDate(task.createdAt)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">
                              Started
                            </span>
                            <span className="text-[10px] text-slate-500 mt-1 block truncate">
                              Timestamp not recorded
                            </span>
                          </>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Assigned By
                        </span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1 truncate">
                          <UserCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          {task.assignedBy?.fullName || 'Master Admin'}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block truncate">
                          Reviewer: {task.reviewer?.fullName || task.assignedBy?.fullName || 'Admin'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Last Updated
                        </span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">
                          {formatDateTime(task.updatedAt || task.createdAt)}
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-slate-500">
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="w-3 h-3 text-purple-600" /> {commentCount} notes
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Paperclip className="w-3 h-3 text-purple-600" /> {attachmentCount} files
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right / Interactive Start Task, Progress & Actions Panel */}
                  <div
                    className={
                      isSingleTaskView
                        ? 'lg:col-span-5 bg-purple-50/40 rounded-2xl p-5 border border-purple-100/80 space-y-4'
                        : 'pt-4 border-t border-slate-100 space-y-4'
                    }
                  >
                    {/* Progress Header + Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">Task Progress</span>
                          <span className="text-[11px] font-medium text-slate-500">
                            •{' '}
                            {notStarted
                              ? 'Not Started'
                              : MILESTONE_LABELS[task.completionPercentage] || 'In Progress'}
                          </span>
                        </div>
                        <span className="text-sm font-extrabold text-purple-700">
                          {task.completionPercentage}%
                        </span>
                      </div>

                      <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            locked
                              ? 'bg-emerald-500'
                              : inReview
                              ? 'bg-amber-500'
                              : 'bg-gradient-to-r from-purple-600 to-indigo-600'
                          }`}
                          style={{ width: `${task.completionPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Conditional Section: Start Task vs Milestone Progress Controls */}
                    {notStarted ? (
                      <div className="p-3.5 rounded-xl bg-white border border-purple-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Ready to begin work?</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Click Start Task to mark this deliverable In Progress and unlock milestone updates.
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={startingTaskId === task.id}
                          onClick={() => handleStartTask(task)}
                          className="shrink-0"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Start Task
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                            <SlidersHorizontal className="w-3 h-3 text-purple-600" />
                            {locked
                              ? 'Task is approved & completed'
                              : inReview
                              ? 'Task is pending review'
                              : 'Update Progress Milestone:'}
                          </span>
                          {task.completionPercentage === 100 && !locked && !inReview && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              Ready to submit for review
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {MILESTONE_STEPS.map((step) => {
                            const isActive = task.completionPercentage === step;
                            return (
                              <button
                                key={step}
                                type="button"
                                disabled={locked || inReview || updatingTaskId === task.id}
                                onClick={() => handleUpdateProgress(task, step)}
                                className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                                  isActive
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50/60'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {step}%
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenTaskDetails(task, false)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Details
                        </Button>

                        {!notStarted && !locked && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenTaskDetails(task, false)}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              Update Progress
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenTaskDetails(task, true)}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Add Note
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                handleOpenTaskDetails(task, false);
                                setTimeout(() => modalFileInputRef.current?.click(), 250);
                              }}
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Upload Proof
                            </Button>
                          </>
                        )}
                      </div>

                      {locked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                          <ShieldCheck className="w-4 h-4" /> Completed
                        </span>
                      ) : inReview ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                          <Clock className="w-3.5 h-3.5" /> Pending Review
                        </span>
                      ) : !notStarted && task.completionPercentage === 100 ? (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={updatingTaskId === task.id}
                          onClick={() => handleSubmitForReview(task)}
                        >
                          <Send className="w-3.5 h-3.5" />
                          Submit for Review
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Comprehensive Task Details, Work Notes & Proof Upload Modal */}
      {selectedTask && (
        <Modal
          isOpen={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          title={selectedTask.title}
          description={`Task #TSK-${selectedTask.id.slice(-6).toUpperCase()} • ${selectedTask.client?.companyName || 'Assigned Client'}`}
          maxWidth="3xl"
        >
          <div className="space-y-6">
            {/* Top Status & Priority Badges */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-lg">
                  <Briefcase className="w-3.5 h-3.5" />
                  {selectedTask.client?.companyName}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  {selectedTask.service?.name || 'General Service'}
                </span>
                {selectedTask.deliverableName ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-3 py-1 rounded-lg">
                    <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                    Deliverable: {selectedTask.deliverableName} ({selectedTask.deliverableCount || 1})
                  </span>
                ) : selectedTask.deliverableCount === 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                    General Task
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge status={selectedTask.priority} />
                <StatusBadge status={selectedTask.status} label={getTaskStatusLabel(selectedTask.status)} />
              </div>
            </div>

            {/* Full Task Description / Instructions */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-600" />
                Task Instructions & Deliverable Brief
              </h4>
              <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-line">
                {selectedTask.description || 'No detailed instructions provided for this task.'}
              </div>
            </div>

            {/* Complete Task Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Due Date</span>
                <span
                  className={`text-xs font-bold mt-1 block ${
                    selectedTask.isOverdue ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {formatDate(selectedTask.dueDate)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Started At</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                  {isTaskNotStarted(selectedTask.status)
                    ? 'Not Started Yet'
                    : selectedTask.startedAt
                    ? formatDateTime(selectedTask.startedAt)
                    : (selectedTask.status === 'COMPLETED' || selectedTask.status === 'APPROVED' || selectedTask.status === 'DELIVERED' || selectedTask.completionPercentage === 100)
                    ? 'Completed (Legacy Record)'
                    : 'Started (timestamp not recorded)'}
                </span>
                {(selectedTask.status === 'COMPLETED' || selectedTask.status === 'APPROVED' || selectedTask.status === 'DELIVERED') && !selectedTask.startedAt && (
                  <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                    Created {formatDate(selectedTask.createdAt)}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Assigned By</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                  {selectedTask.assignedBy?.fullName || 'Master Admin'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Reviewer</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                  {selectedTask.reviewer?.fullName || selectedTask.assignedBy?.fullName || 'Admin'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Assigned Employee</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                  {selectedTask.assignedTo?.fullName || 'You'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Deliverable Count</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block">
                  {selectedTask.deliverableCount && selectedTask.deliverableCount > 0
                    ? `${selectedTask.deliverableCount} unit(s)`
                    : '1 Task Deliverable'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Created On</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block">
                  {formatDate(selectedTask.createdAt)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Last Updated</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block">
                  {formatDateTime(selectedTask.updatedAt || selectedTask.createdAt)}
                </span>
              </div>
            </div>

            {/* Interactive Start Task OR Milestone & Review Submission Box */}
            {isTaskNotStarted(selectedTask.status) ? (
              <div className="p-5 bg-purple-50/80 rounded-2xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-bold text-purple-950 block">
                    This task has not been started yet (Progress: 0%)
                  </span>
                  <span className="text-xs text-purple-700 mt-0.5 block">
                    Click Start Task to set status to In Progress, record your start timestamp, and unlock milestone progress updates.
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  isLoading={startingTaskId === selectedTask.id}
                  onClick={() => handleStartTask(selectedTask)}
                  className="shrink-0"
                >
                  <Play className="w-4 h-4" />
                  Start Task
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-100 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-purple-950 block">
                      Update Completion Milestone ({selectedTask.completionPercentage}%)
                    </span>
                    <span className="text-[11px] text-purple-700">
                      {isTaskLocked(selectedTask.status)
                        ? 'This task has been approved and completed.'
                        : isTaskInReview(selectedTask.status)
                        ? 'This task is currently pending review by Admin.'
                        : 'Setting 100% unlocks "Submit for Review" so Admin can review and approve your work.'}
                    </span>
                  </div>

                  {!isTaskLocked(selectedTask.status) &&
                    !isTaskInReview(selectedTask.status) &&
                    selectedTask.completionPercentage === 100 && (
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={updatingTaskId === selectedTask.id}
                        onClick={() => handleSubmitForReview(selectedTask)}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Submit for Review
                      </Button>
                    )}
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {MILESTONE_STEPS.map((step) => (
                    <button
                      key={step}
                      type="button"
                      disabled={
                        isTaskLocked(selectedTask.status) ||
                        isTaskInReview(selectedTask.status) ||
                        updatingTaskId === selectedTask.id
                      }
                      onClick={() => handleUpdateProgress(selectedTask, step)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                        selectedTask.completionPercentage === step
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {step}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Proof of Work / Deliverables Attachments Section */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-purple-600" />
                  Proof of Work & Attachments ({selectedTask.attachments?.length || 0})
                </h4>
                <div>
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={isUploadingFile}
                    onClick={() => modalFileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Proof File
                  </Button>
                </div>
              </div>

              {selectedTask.attachments && selectedTask.attachments.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {selectedTask.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-purple-300 transition-all text-xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Paperclip className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate" title={att.fileName}>
                            {att.fileName}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Uploaded by {att.uploadedBy?.fullName || selectedTask.assignedTo?.fullName || 'You'} •{' '}
                            {formatDateTime(att.createdAt)}
                            {att.fileType ? ` • ${att.fileType}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            taskService
                              .viewAttachment(selectedTask.id, att.id, att.fileName, att.fileType)
                              .catch(() => toast.error(`Unable to open "${att.fileName}"`))
                          }
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            taskService
                              .downloadAttachment(selectedTask.id, att.id, att.fileName, att.fileType)
                              .then(() => toast.success(`Downloaded "${att.fileName}"`))
                              .catch(() => toast.error(`Unable to download "${att.fileName}"`))
                          }
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 text-center">
                  No proof uploaded yet
                </p>
              )}
            </div>

            {/* Work Notes & Activity History Feed */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-purple-600" />
                Task Activity & Work Notes ({selectedTask.comments?.length || 0})
              </h4>

              <div className="max-h-52 overflow-y-auto space-y-2.5 pr-1">
                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{c.user?.fullName || 'Team Member'}</span>
                          {c.user?.role && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                              {c.user.role}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-700 mt-1.5 leading-relaxed whitespace-pre-line">{c.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 text-center">
                    No activity or work notes yet. Add a note below to share deliverable links or status updates.
                  </p>
                )}
              </div>

              <form onSubmit={handleAddComment} className="space-y-2">
                <textarea
                  ref={commentInputRef}
                  rows={2}
                  placeholder="Add a work note, deliverable link, or update for your reviewer..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isPostingComment}
                    disabled={!commentText.trim()}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Post Work Note
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
