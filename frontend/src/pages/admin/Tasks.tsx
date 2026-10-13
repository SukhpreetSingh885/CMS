import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  AlertCircle,
  MessageSquare,
  Paperclip,
  Check,
  Clock,
  User as UserIcon,
  Play,
  RotateCcw,
  Eye,
  Download,
  FileText,
  CheckCircle,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { taskService, clientService, userService, packageService } from '../../services';
import { Task, Client, User, ServiceItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
  FilterDrawer,
} from '../../components/filters';

const createTaskSchema = z.object({
  title: z.string().min(2, 'Task title is required'),
  clientId: z.string().min(1, 'Client is required'),
  serviceId: z.string().optional(),
  assignedToId: z.string().min(1, 'Assigned user is required'),
  reviewerId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  startDate: z.string().optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  estimatedHours: z.number().nonnegative().optional(),
  deliverableCount: z.number().int().nonnegative().optional(),
  deliverableId: z.string().optional().nullable(),
  deliverableName: z.string().optional().nullable(),
  clientApprovalRequired: z.boolean().default(false),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
});

type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

export const Tasks: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters, activeFiltersCount } =
    useSmartFilters({
      search: '',
      clientId: '',
      assignedToId: '',
      serviceId: '',
      reviewerId: '',
      status: '',
      priority: '',
      isOverdue: '',
      dateRange: '',
      dueDateFrom: '',
      dueDateTo: '',
      minProgress: '',
      maxProgress: '',
      sortBy: 'dueDate',
      sortOrder: 'asc',
    });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDeliverableReview, setTaskDeliverableReview] = useState<any>(null);
  const [taskApprovedQty, setTaskApprovedQty] = useState<number>(1);
  const [taskSelectedDeliverableId, setTaskSelectedDeliverableId] = useState<string>('');
  const [taskAllowOverCredit, setTaskAllowOverCredit] = useState<boolean>(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      assignedToId: currentUser?.id,
    },
  });

  const watchedClientId = watch('clientId');
  const watchedServiceId = watch('serviceId');
  const selectedClientForModal: any = clients.find((c) => c.id === watchedClientId);
  const clientPurchasedServices: any[] = selectedClientForModal?.services || [];
  const selectedClientServiceForModal = clientPurchasedServices.find(
    (s: any) => s.serviceId === watchedServiceId
  );
  const selectedServiceTeamForModal: any[] = selectedClientServiceForModal
    ? Array.isArray(selectedClientServiceForModal.assignedEmployees) &&
      selectedClientServiceForModal.assignedEmployees.length > 0
      ? selectedClientServiceForModal.assignedEmployees.map((ae: any) => ae.employee).filter(Boolean)
      : selectedClientServiceForModal.assignedEmployee
      ? [selectedClientServiceForModal.assignedEmployee]
      : []
    : [];

  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string>('');

  const modalDeliverablesList: any[] = useMemo(() => {
    if (!selectedClientServiceForModal) return [];
    if (Array.isArray(selectedClientServiceForModal.deliverablesConfig)) {
      return selectedClientServiceForModal.deliverablesConfig.filter((d: any) => d && d.isIncluded !== false);
    }
    return [];
  }, [selectedClientServiceForModal]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const isTaskUnstarted = (task: Task) =>
    (task.status === 'ASSIGNED' || task.status === 'CREATED') &&
    (task.completionPercentage || 0) === 0 &&
    !task.startedAt;

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const res = await taskService.listTasks({
        search: filters.search || undefined,
        clientId: filters.clientId || undefined,
        assignedToId: filters.assignedToId || undefined,
        serviceId: filters.serviceId || undefined,
        reviewerId: filters.reviewerId || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        isOverdue: filters.isOverdue === 'true' ? true : undefined,
        dateRange: (filters.dateRange as any) || undefined,
        dueDateFrom: filters.dueDateFrom || undefined,
        dueDateTo: filters.dueDateTo || undefined,
        minProgress: filters.minProgress ? Number(filters.minProgress) : undefined,
        maxProgress: filters.maxProgress ? Number(filters.maxProgress) : undefined,
        sortBy: filters.sortBy || undefined,
        sortOrder: filters.sortOrder || undefined,
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTaskDetails = async (task: Task) => {
    setSelectedTask(task);
    setTaskDeliverableReview(null);
    try {
      const [fullTask, reviewCtx] = await Promise.all([
        taskService.getTaskById(task.id),
        taskService.getTaskDeliverableReview(task.id).catch(() => null),
      ]);
      setSelectedTask(fullTask);
      setTaskDeliverableReview(reviewCtx);
      if (reviewCtx?.reviewSummary) {
        const initialQty =
          reviewCtx.reviewSummary.suggestedApprovedQuantity !== undefined
            ? reviewCtx.reviewSummary.suggestedApprovedQuantity
            : (fullTask.deliverableCount && fullTask.deliverableCount > 0)
            ? fullTask.deliverableCount
            : 1;
        setTaskApprovedQty(initialQty);
        setTaskSelectedDeliverableId(
          reviewCtx.matchedDeliverable?.id || reviewCtx.availableDeliverables?.[0]?.id || ''
        );
        setTaskAllowOverCredit(false);
      }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...fullTask } : t)));
    } catch {
      // Fallback to list task if detail request fails
    }
  };


  const handleViewAttachment = async (
    taskId: string,
    attachmentId: string,
    fileName: string,
    fileType?: string
  ) => {
    try {
      await taskService.viewAttachment(taskId, attachmentId, fileName, fileType);
    } catch {
      toast.error(`Unable to open attachment "${fileName}".`);
    }
  };

  const handleDownloadAttachment = async (
    taskId: string,
    attachmentId: string,
    fileName: string,
    fileType?: string
  ) => {
    try {
      await taskService.downloadAttachment(taskId, attachmentId, fileName, fileType);
      toast.success(`Downloaded "${fileName}"`);
    } catch {
      toast.error(`Unable to download attachment "${fileName}".`);
    }
  };

  const loadInitialData = async () => {
    const [clientRes, userRes, svcRes] = await Promise.all([
      clientService.listClients({ pageSize: 100 }),
      userService.listUsers({ pageSize: 100 }),
      packageService.listServices(),
    ]);
    setClients(clientRes.data || []);
    setUsers(userRes.data || []);
    setServices(svcRes || []);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [
    filters.search,
    filters.clientId,
    filters.assignedToId,
    filters.serviceId,
    filters.reviewerId,
    filters.status,
    filters.priority,
    filters.isOverdue,
    filters.dateRange,
    filters.dueDateFrom,
    filters.dueDateTo,
    filters.minProgress,
    filters.maxProgress,
    filters.sortBy,
    filters.sortOrder,
  ]);

  const invalidateTaskCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const handleCreate = async (data: CreateTaskFormValues) => {
    setIsSubmitting(true);
    try {
      await taskService.createTask({
        ...data,
        estimatedHours: Number(data.estimatedHours) || 0,
        deliverableCount: Number(data.deliverableCount) || 0,
        deliverableId: data.deliverableId || null,
        deliverableName: data.deliverableName || null,
      });
      toast.success('Task created with Not Started (0%) status');
      setIsCreateOpen(false);
      reset();
      setSelectedDeliverableId('');
      loadTasks();
      invalidateTaskCaches();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      const started = await taskService.startTask(taskId);
      toast.success('Task started! Status is now In Progress.');
      if (selectedTask?.id === taskId) {
        setSelectedTask(started);
      }
      loadTasks();
      invalidateTaskCaches();
    } catch {
      // Handled
    }
  };

  const handleUpdateStatus = async (
    taskId: string,
    newStatus: any,
    completionPercentage?: number,
    comment?: string
  ) => {
    try {
      const updated = await taskService.updateTaskStatus(taskId, {
        status: newStatus,
        completionPercentage,
        comment,
      });
      toast.success(`Task status updated to ${newStatus}`);
      if (selectedTask?.id === taskId) {
        setSelectedTask(updated);
      }
      loadTasks();
      invalidateTaskCaches();
    } catch {
      // Handled
    }
  };

  const handleApproveTaskDeliverables = async () => {
    if (!selectedTask) return;
    setIsSubmitting(true);
    try {
      const updated = await taskService.approveTaskDeliverables(selectedTask.id, {
        approvedQuantity: taskApprovedQty,
        feedback: newComment.trim() || undefined,
        deliverableId: taskSelectedDeliverableId || undefined,
        allowOverCredit: taskAllowOverCredit,
      });
      toast.success(
        `Task approved! Credited ${taskApprovedQty} deliverable(s). Client package progress updated.`
      );
      setSelectedTask(updated);
      setNewComment('');
      loadTasks();
      invalidateTaskCaches();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to approve task deliverables');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectTask = async () => {
    if (!selectedTask) return;
    if (!newComment.trim()) {
      toast.error('Please enter revision feedback in the comment box below before requesting changes.');
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await taskService.rejectTask(selectedTask.id, {
        feedback: newComment.trim(),
      });
      toast.success('Task returned to employee for revision.');
      setSelectedTask(updated);
      setNewComment('');
      loadTasks();
      invalidateTaskCaches();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to request changes');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;
    try {
      const comment = await taskService.addComment(selectedTask.id, newComment);
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
      setNewComment('');
      toast.success('Comment added');
      invalidateTaskCaches();
    } catch {
      // Handled
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    const attCount = taskToDelete.attachments?.length || (taskToDelete._count?.attachments ?? 0);
    const commCount = taskToDelete.comments?.length || (taskToDelete._count?.comments ?? 0);
    const isCompleted = ['COMPLETED', 'DELIVERED', 'APPROVED'].includes(taskToDelete.status);
    const hasSensitiveData = attCount > 0 || commCount > 0 || isCompleted;

    if (hasSensitiveData && deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Please type DELETE to confirm removal of this task and its associated files.');
      return;
    }

    setIsDeletingTask(true);
    try {
      await taskService.deleteTask(taskToDelete.id, {
        confirmation: hasSensitiveData ? 'DELETE' : undefined,
      });
      toast.success(`Task "${taskToDelete.title}" deleted successfully`);
      setTaskToDelete(null);
      setDeleteConfirmText('');
      if (selectedTask?.id === taskToDelete.id) {
        setSelectedTask(null);
      }
      loadTasks();
      invalidateTaskCaches();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete task');
    } finally {
      setIsDeletingTask(false);
    }
  };

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.clientId) {
      const c = clients.find((client) => client.id === filters.clientId);
      list.push({ key: 'clientId', label: 'Client', value: filters.clientId, displayValue: c?.companyName });
    }
    if (filters.assignedToId) {
      const u = users.find((user) => user.id === filters.assignedToId);
      list.push({ key: 'assignedToId', label: 'Assignee', value: filters.assignedToId, displayValue: u?.fullName });
    }
    if (filters.serviceId) {
      const s = services.find((svc) => svc.id === filters.serviceId);
      list.push({ key: 'serviceId', label: 'Service', value: filters.serviceId, displayValue: s?.name });
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
  }, [filters, clients, users, services]);

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
        title="Tasks Management"
        description="Assign, track, and review client tasks with automated progress milestones."
        actions={
          <Button
            onClick={() => {
              reset({
                priority: 'MEDIUM',
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                assignedToId: currentUser?.id,
              });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Task
          </Button>
        }
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
        onOpenAdvanced={() => setIsAdvancedOpen(true)}
        advancedCount={
          [
            filters.serviceId,
            filters.reviewerId,
            filters.minProgress,
            filters.maxProgress,
            filters.sortBy !== 'dueDate' ? filters.sortBy : null,
          ].filter(Boolean).length
        }
        advancedLabel="Advanced Filters"
      >
        <SearchInput
          placeholder="Search task title or description..."
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
          label="Assigned Staff"
          value={filters.assignedToId}
          onChange={(val) => setFilter('assignedToId', val)}
          options={users.map((u) => ({
            label: `${u.fullName} (${u.role === 'ADMIN' ? 'Admin' : u.designation || 'Staff'})`,
            value: u.id,
          }))}
        />

        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(val) => setFilter('status', val)}
          options={[
            { label: 'Not Started', value: 'ASSIGNED' },
            { label: 'In Progress', value: 'IN_PROGRESS' },
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

      {/* Advanced Filter Drawer */}
      <FilterDrawer
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
        title="Advanced Task Filters & Sorting"
        onApply={() => setIsAdvancedOpen(false)}
        onReset={() => {
          clearAllFilters();
          setIsAdvancedOpen(false);
        }}
        activeFiltersCount={activeFiltersCount}
      >
        <div className="space-y-4">
          <FilterSelect
            label="Service Deliverable"
            value={filters.serviceId}
            onChange={(val) => setFilter('serviceId', val)}
            options={services.map((s) => ({ label: s.name, value: s.id }))}
          />

          <FilterSelect
            label="Reviewer Staff"
            value={filters.reviewerId}
            onChange={(val) => setFilter('reviewerId', val)}
            options={users.map((u) => ({
              label: `${u.fullName} (${u.role === 'ADMIN' ? 'Admin' : u.designation || 'Staff'})`,
              value: u.id,
            }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Min Progress (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={filters.minProgress}
                onChange={(e) => setFilter('minProgress', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Max Progress (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="100"
                value={filters.maxProgress}
                onChange={(e) => setFilter('maxProgress', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Sort Records
            </label>
            <div className="grid grid-cols-2 gap-3">
              <FilterSelect
                label="Sort By"
                value={filters.sortBy}
                onChange={(val) => setFilter('sortBy', val)}
                options={[
                  { label: 'Due Date', value: 'dueDate' },
                  { label: 'Creation Date', value: 'createdAt' },
                  { label: 'Priority', value: 'priority' },
                  { label: 'Last Updated', value: 'updatedAt' },
                  { label: 'Progress %', value: 'completionPercentage' },
                ]}
              />
              <FilterSelect
                label="Order"
                value={filters.sortOrder}
                onChange={(val) => setFilter('sortOrder', val)}
                options={[
                  { label: 'Ascending', value: 'asc' },
                  { label: 'Descending', value: 'desc' },
                ]}
              />
            </div>
          </div>
        </div>
      </FilterDrawer>

      {isLoading ? (
        <LoadingState message="Loading tasks..." />
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No tasks match your filter criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search query, changing status or assignee filters, or resetting all filters.
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
                  <th className="py-3 px-5">Task Details</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => {
                  const commentCount = task._count?.comments ?? task.comments?.length ?? 0;
                  const attachmentCount = task._count?.attachments ?? task.attachments?.length ?? 0;

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="max-w-md">
                          <p
                            onClick={() => handleOpenTaskDetails(task)}
                            className="font-bold text-slate-900 hover:text-purple-600 cursor-pointer truncate"
                          >
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {task.service && (
                              <span className="text-[10px] text-purple-600 font-medium">
                                {task.service.name}
                              </span>
                            )}
                            {task.deliverableName ? (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                                Deliverable: {task.deliverableName} {task.deliverableCount ? `(${task.deliverableCount})` : ''}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                General Task
                              </span>
                            )}
                            {attachmentCount > 0 && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded"
                                title={`${attachmentCount} proof attachment(s) uploaded`}
                              >
                                <Paperclip className="w-3 h-3" /> {attachmentCount}
                              </span>
                            )}
                            {commentCount > 0 && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded"
                                title={`${commentCount} comment(s)`}
                              >
                                <MessageSquare className="w-3 h-3" /> {commentCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {task.client?.companyName}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                            {task.assignedTo?.fullName?.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-900">{task.assignedTo?.fullName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            task.priority === 'URGENT'
                              ? 'bg-rose-100 text-rose-700'
                              : task.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={task.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                          {formatDate(task.dueDate)}
                          {task.isOverdue && <span className="block text-[10px]">Overdue!</span>}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={task.status} />
                        {task.startedAt ? (
                          <span className="block text-[10px] text-slate-400 mt-1">
                            Started: {formatDateTime(task.startedAt)}
                          </span>
                        ) : (task.status === 'COMPLETED' || task.status === 'APPROVED' || task.status === 'DELIVERED') ? (
                          <span className="block text-[10px] text-slate-400 mt-1">
                            Completed (Legacy Record)
                          </span>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-purple-700">{task.completionPercentage}%</span>
                          <div className="w-14 bg-slate-100 rounded-full h-1.5">
                            <div
                              className="bg-purple-600 h-1.5 rounded-full"
                              style={{ width: `${task.completionPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenTaskDetails(task)}
                            className="text-xs"
                          >
                            View & Update
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTaskToDelete(task);
                              setDeleteConfirmText('');
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Task"
        description="Assign task to an employee or self-assign to Admin"
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <Input
            label="Task Title *"
            placeholder="e.g. Design Meta Ads Carousel Set (5 variations)"
            error={errors.title?.message}
            {...register('title')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Client *</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                {...register('clientId')}
              >
                <option value="">Select Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
              {errors.clientId && <p className="text-xs text-rose-500 mt-1">{errors.clientId.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Related Service</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                {...register('serviceId')}
              >
                <option value="">None / General</option>
                {(clientPurchasedServices.length > 0
                  ? clientPurchasedServices.map((cs: any) => ({
                      id: cs.serviceId,
                      name: cs.service?.name || 'Service',
                    }))
                  : services
                ).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {modalDeliverablesList.length > 0 && (
            <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-lg">
              <label className="block text-xs font-semibold text-purple-900 mb-1.5">
                Target Agreed Deliverable (Optional)
              </label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                value={selectedDeliverableId}
                onChange={(e) => {
                  const dId = e.target.value;
                  setSelectedDeliverableId(dId);
                  const matched = modalDeliverablesList.find((d: any) => d.id === dId);
                  if (matched) {
                    setValue('deliverableId', matched.id);
                    setValue('deliverableName', matched.name);
                    setValue('deliverableCount', matched.deliverableType === 'FEATURE' ? 1 : (matched.quantity || 1));
                  } else {
                    setValue('deliverableId', null);
                    setValue('deliverableName', null);
                    setValue('deliverableCount', 0);
                  }
                }}
              >
                <option value="">General / Setup Task (Not tied to agreed deliverables)</option>
                {modalDeliverablesList.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.deliverableType === 'FEATURE' ? 'Feature' : `${d.quantity || 1} ${d.unit || 'units'}`}) [{d.targetPeriod || 'MONTHLY'}]
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-purple-700 mt-1">
                Linking a task to an agreed deliverable connects task approval to package deliverable completion metrics.
              </p>
            </div>
          )}

          {watchedClientId && watchedServiceId && selectedClientServiceForModal && selectedServiceTeamForModal.length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
              <p className="text-amber-900 font-medium text-[11px]">
                No employees assigned to this service. Please assign a service team before creating employee tasks.
              </p>
              <Link
                to={`/admin/clients/${watchedClientId}?tab=services`}
                onClick={() => setIsCreateOpen(false)}
                className="shrink-0 font-semibold text-purple-700 hover:underline text-[11px]"
              >
                Assign Employees →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Assigned To *</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                {...register('assignedToId')}
              >
                <optgroup label="Admins (Self & Team)">
                  {users
                    .filter((u) => u.role === 'ADMIN')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} {u.id === currentUser?.id ? '(Self Assign)' : '(Admin)'}
                      </option>
                    ))}
                </optgroup>
                <optgroup
                  label={
                    watchedServiceId && selectedClientServiceForModal
                      ? 'Assigned Service Team'
                      : 'Employees'
                  }
                >
                  {(watchedServiceId && selectedClientServiceForModal
                    ? selectedServiceTeamForModal
                    : users.filter((u) => u.role === 'EMPLOYEE')
                  ).map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.designation || 'Staff'})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Priority</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                {...register('priority')}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent (Priority 1)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Due Date *" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
            <Input label="Estimated Hours" type="number" step="0.5" {...register('estimatedHours', { valueAsNumber: true })} />
            <Input
              label="Deliverable Units"
              type="number"
              min="0"
              placeholder="0 (if non-deliverable)"
              {...register('deliverableCount', { valueAsNumber: true })}
            />
          </div>

          <Textarea label="Task Description & Scope" placeholder="Provide instructions, references, asset links..." {...register('description')} />

          <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              id="clientAppr"
              {...register('clientApprovalRequired')}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="clientAppr" className="font-medium text-slate-800 cursor-pointer">
              Client Approval Required (Must be recorded before final completion)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Create & Assign Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Details & Update Modal */}
      {selectedTask && (
        <Modal
          isOpen={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          title={selectedTask.title}
          description={`Client: ${selectedTask.client?.companyName} • Assignee: ${selectedTask.assignedTo?.fullName}`}
          maxWidth="3xl"
        >
          <div className="space-y-6">
            {/* Quick Status Bar */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Current Status:</span>
                  <StatusBadge status={selectedTask.status} />
                  {selectedTask.deliverableName ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      Deliverable: {selectedTask.deliverableName} ({selectedTask.deliverableCount || 1})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      General Task (0 Deliverables)
                    </span>
                  )}
                </div>
                {selectedTask.startedAt ? (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-600" />
                    Started at {formatDateTime(selectedTask.startedAt)}
                    {selectedTask.startedBy?.fullName ? ` by ${selectedTask.startedBy.fullName}` : ''}
                  </span>
                ) : (selectedTask.status === 'COMPLETED' || selectedTask.status === 'APPROVED' || selectedTask.status === 'DELIVERED') ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-emerald-700 font-medium">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Completed (Legacy Record)
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 font-normal">
                      Created: {formatDate(selectedTask.createdAt)}
                    </span>
                    {selectedTask.completedAt ? (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 font-normal">
                          Finished: {formatDate(selectedTask.completedAt)}
                        </span>
                      </>
                    ) : selectedTask.updatedAt ? (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 font-normal">
                          Last Updated: {formatDate(selectedTask.updatedAt)}
                        </span>
                      </>
                    ) : null}
                  </div>
                ) : isTaskUnstarted(selectedTask) ? (
                  <span className="text-[11px] text-slate-400">
                    Task has not been started yet
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Started (start timestamp not recorded)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Milestone Progress:</span>
                {[0, 25, 50, 75, 100].map((step) => {
                  const isUnstarted = isTaskUnstarted(selectedTask);
                  const isCompleted =
                    selectedTask.status === 'COMPLETED' ||
                    selectedTask.status === 'APPROVED' ||
                    selectedTask.status === 'DELIVERED';
                  return (
                    <button
                      key={step}
                      disabled={(isUnstarted && step > 0) || isCompleted}
                      title={
                        isUnstarted && step > 0
                          ? 'Start the task first before updating progress'
                          : isCompleted
                          ? 'Task is already completed'
                          : `Set progress to ${step}%`
                      }
                      onClick={() => {
                        handleUpdateStatus(selectedTask.id, 'IN_PROGRESS', step);
                      }}
                      className={`px-2 py-1 text-xs font-bold rounded-md border transition-all ${
                        selectedTask.completionPercentage === step
                          ? 'bg-purple-600 text-white border-purple-600'
                          : (isUnstarted && step > 0) || isCompleted
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {step}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Task Description */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Description
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                {selectedTask.description || 'No detailed description provided.'}
              </p>
            </div>

            {/* Status Workflow Action Buttons & Deliverable Approval */}
            {(() => {
              const isSubmittedForReview =
                ['INTERNAL_REVIEW', 'CLIENT_APPROVAL'].includes(selectedTask.status) &&
                selectedTask.completionPercentage === 100;
              const isAlreadyApprovedOrCompleted =
                ['COMPLETED', 'APPROVED', 'DELIVERED'].includes(selectedTask.status);
              const canSubmitForReview =
                ['IN_PROGRESS', 'REVISION_REQUIRED'].includes(selectedTask.status) &&
                selectedTask.completionPercentage === 100;

              const rev = taskDeliverableReview?.reviewSummary;
              const targetDeliverable =
                taskDeliverableReview?.availableDeliverables?.find(
                  (d: any) => d.id === taskSelectedDeliverableId
                ) || taskDeliverableReview?.matchedDeliverable;

              const targetQty = targetDeliverable?.quantity ?? rev?.targetQuantity ?? 1;
              const unit = targetDeliverable?.unit || rev?.unit || 'units';
              const previouslyApproved = rev?.previouslyApproved ?? 0;
              const remainingQty = Math.max(0, targetQty - previouslyApproved);
              const deliverableType = targetDeliverable?.deliverableType || rev?.deliverableType || 'QUANTITY';
              const isOverTarget = previouslyApproved + taskApprovedQty > targetQty;
              const previewPct = Math.min(
                100,
                Math.round(((previouslyApproved + taskApprovedQty) / Math.max(1, targetQty)) * 100)
              );

              return (
                <div className="space-y-3.5">
                  {/* PENDING APPROVAL CARD (When task is submitted for review at 100%) */}
                  {isSubmittedForReview && (
                    <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-purple-700" />
                          Deliverable Approval & Package Progress Credit
                        </h4>
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded uppercase">
                          {deliverableType}
                        </span>
                      </div>

                      {targetDeliverable && (
                        <p className="text-xs font-bold text-slate-900">
                          Agreed Deliverable:{' '}
                          <span className="text-purple-800 font-extrabold">{targetDeliverable.name}</span>
                        </p>
                      )}

                      {/* Deliverable Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2 bg-white rounded-lg border border-purple-100 shadow-2xs">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Target</span>
                          <span className="text-sm font-extrabold text-slate-900">
                            {targetQty} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-purple-100 shadow-2xs">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Prev Approved</span>
                          <span className="text-sm font-extrabold text-slate-700">
                            {previouslyApproved} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-purple-100 shadow-2xs">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Remaining</span>
                          <span className="text-sm font-extrabold text-purple-700">
                            {remainingQty} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-purple-100 shadow-2xs">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Progress After</span>
                          <span className="text-sm font-extrabold text-emerald-600">
                            {previewPct}%
                          </span>
                        </div>
                      </div>

                      {/* Approved Quantity Input */}
                      {deliverableType !== 'FEATURE' ? (
                        <div className="p-2.5 bg-white rounded-lg border border-purple-200/80 space-y-2">
                          <label className="block text-xs font-bold text-slate-900">
                            Approved Quantity to Credit ({unit}):
                          </label>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                              <button
                                type="button"
                                onClick={() => setTaskApprovedQty((prev) => Math.max(0, prev - 1))}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={0}
                                value={taskApprovedQty}
                                onChange={(e) => setTaskApprovedQty(Math.max(0, Number(e.target.value) || 0))}
                                className="w-16 text-center py-1.5 text-xs font-extrabold text-slate-900 border-x border-slate-300 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => setTaskApprovedQty((prev) => prev + 1)}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs text-slate-600">
                              Will credit <strong>{taskApprovedQty}</strong> {unit} towards{' '}
                              <strong>{selectedTask.client?.companyName}</strong> package progress ({previewPct}%).
                            </span>
                          </div>

                          {isOverTarget && (
                            <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-xs space-y-1">
                              <div className="flex items-center gap-1 font-bold text-amber-800">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                Over-credit Warning
                              </div>
                              <p className="text-[11px]">
                                Crediting {taskApprovedQty} {unit} exceeds agreed target of {targetQty} {unit}.
                              </p>
                              <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={taskAllowOverCredit}
                                  onChange={(e) => setTaskAllowOverCredit(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded text-amber-600"
                                />
                                Authorize target override
                              </label>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-2.5 bg-white rounded-lg border border-purple-200/80 text-xs text-slate-700">
                          Feature deliverable will be marked <strong>Completed (100%)</strong> upon approval.
                        </div>
                      )}

                      {/* Approval Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRejectTask}
                          isLoading={isSubmitting}
                          className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Request Changes
                        </Button>

                        <Button
                          size="sm"
                          variant="primary"
                          onClick={handleApproveTaskDeliverables}
                          isLoading={isSubmitting}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Approve Task & Credit Deliverables
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ALREADY APPROVED BADGE */}
                  {isAlreadyApprovedOrCompleted && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold">
                            Task Approved & Completed ({selectedTask.deliverableCount || 0} deliverable(s) credited)
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            Deliverables are officially credited towards client package progress.
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={selectedTask.status} />
                    </div>
                  )}

                  {/* Standard Workflow Buttons */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Workflow Actions
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedTask.status === 'ASSIGNED' || selectedTask.status === 'CREATED') &&
                        selectedTask.assignedToId === currentUser?.id && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleStartTask(selectedTask.id)}
                          >
                            <Play className="w-3.5 h-3.5 mr-1" /> Start Task
                          </Button>
                        )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleUpdateStatus(
                            selectedTask.id,
                            'IN_PROGRESS',
                            selectedTask.completionPercentage || 0
                          )
                        }
                      >
                        Mark In Progress
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canSubmitForReview}
                        title={
                          !canSubmitForReview
                            ? 'Task must be In Progress at 100% completion before submitting for review'
                            : 'Submit task for Internal Review'
                        }
                        onClick={() => handleUpdateStatus(selectedTask.id, 'INTERNAL_REVIEW', 100)}
                      >
                        Submit for Internal Review
                      </Button>
                      {selectedTask.clientApprovalRequired && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isSubmittedForReview}
                          title={
                            !isSubmittedForReview
                              ? 'Task must be in Internal Review at 100% before Client Approval'
                              : 'Mark Client Approval'
                          }
                          onClick={() => handleUpdateStatus(selectedTask.id, 'CLIENT_APPROVAL', 100)}
                        >
                          Mark Client Approval
                        </Button>
                      )}
                    </div>
                    {!isSubmittedForReview && !isAlreadyApprovedOrCompleted && (
                      <p className="text-[11px] text-slate-500 mt-2">
                        Note: <strong>Deliverable Approval</strong> requires the task to reach 100% progress and be submitted for review first.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}


            {/* Proof of Work & Attachments Section (above Comments & Activity) */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-purple-600" />
                  Proof of Work & Attachments ({selectedTask.attachments?.length || 0})
                </h4>
              </div>

              {selectedTask.attachments && selectedTask.attachments.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {selectedTask.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-purple-200 transition-all text-xs"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate" title={att.fileName}>
                            {att.fileName}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
                            <span>
                              Uploaded by{' '}
                              <strong className="text-slate-700">
                                {att.uploadedBy?.fullName || selectedTask.assignedTo?.fullName || 'Employee'}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>{formatDateTime(att.createdAt)}</span>
                            {att.fileType && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.2 rounded text-slate-600">
                                  {att.fileType}
                                </span>
                              </>
                            )}
                            {att.fileSize ? (
                              <>
                                <span>•</span>
                                <span>{formatFileSize(att.fileSize)}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleViewAttachment(selectedTask.id, att.id, att.fileName, att.fileType)
                          }
                          className="text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleDownloadAttachment(selectedTask.id, att.id, att.fileName, att.fileType)
                          }
                          className="text-xs"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 bg-slate-50 py-3 px-4 rounded-xl border border-dashed border-slate-200 text-center">
                  No proof uploaded yet
                </p>
              )}
            </div>

            {/* Comments Feed */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Comments & Activity ({selectedTask.comments?.length || 0})
              </h4>

              <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1">
                {selectedTask.comments?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No comments posted yet.</p>
                ) : (
                  selectedTask.comments?.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">{c.user?.fullName}</span>
                        <span className="text-[10px] text-slate-400">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="text-slate-700">{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a task update or feedback..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <Button type="submit" size="sm">
                  Comment
                </Button>
              </form>
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTaskToDelete(selectedTask);
                  setDeleteConfirmText('');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Task
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedTask(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Safe Task Deletion Modal */}
      {taskToDelete && (
        <Modal
          isOpen={Boolean(taskToDelete)}
          onClose={() => {
            setTaskToDelete(null);
            setDeleteConfirmText('');
          }}
          title="Delete Task"
          description={`Permanently remove task #${taskToDelete.id.slice(-6).toUpperCase()} from the system.`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
              <p className="font-bold text-slate-900">{taskToDelete.title}</p>
              <p className="text-slate-600">Client: <span className="font-semibold">{taskToDelete.client?.companyName}</span></p>
              <p className="text-slate-600">Assignee: <span className="font-semibold">{taskToDelete.assignedTo?.fullName}</span></p>
              <div className="flex items-center gap-2 pt-1">
                <StatusBadge status={taskToDelete.status} />
                <span className="text-slate-500">• Progress: {taskToDelete.completionPercentage}%</span>
              </div>
            </div>

            {((taskToDelete.attachments?.length || 0) > 0 ||
              (taskToDelete.comments?.length || 0) > 0 ||
              ['COMPLETED', 'DELIVERED', 'APPROVED'].includes(taskToDelete.status)) ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Warning: Sensitive Task History
                </div>
                <p className="text-[11px] leading-relaxed">
                  This task has <strong>{taskToDelete.attachments?.length || 0} attachment(s)</strong> and{' '}
                  <strong>{taskToDelete.comments?.length || 0} comment(s)</strong>, and is marked as{' '}
                  <strong>{taskToDelete.status}</strong>. Deleting it will permanently remove all work notes and proof files.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Type <span className="font-mono bg-amber-100 px-1 py-0.5 rounded">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    placeholder="DELETE"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Are you sure you want to remove this task? This action is permanent and cannot be undone.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeletingTask}
                onClick={() => {
                  setTaskToDelete(null);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={isDeletingTask}
                disabled={
                  Boolean(
                    ((taskToDelete.attachments?.length || 0) > 0 ||
                      (taskToDelete.comments?.length || 0) > 0 ||
                      ['COMPLETED', 'DELIVERED', 'APPROVED'].includes(taskToDelete.status)) &&
                    deleteConfirmText.trim().toUpperCase() !== 'DELETE'
                  )
                }
                onClick={handleDeleteTask}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

