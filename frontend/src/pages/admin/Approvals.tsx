import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { contentAndApprovalService, taskService, clientService, userService } from '../../services';
import { User, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { formatDate, formatDateTime } from '../../utils/formatters';
import {
  Clock,
  CheckCircle2,
  RotateCcw,
  FileText,
  CheckSquare,
  Film,
  ArrowRight,
  Eye,
  Download,
  AlertTriangle,
  Layers,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
} from '../../components/filters';

export const Approvals: React.FC = () => {
  const queryClient = useQueryClient();
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters, activeFiltersCount } =
    useSmartFilters({
      type: 'ALL',
      search: '',
      clientId: '',
      submittedById: '',
      dateRange: '',
      startDate: '',
      endDate: '',
    });

  const [approvalsData, setApprovalsData] = useState<any>(null);
  const [employees, setEmployees] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [feedback, setFeedback] = useState('');
  const [approvedQuantity, setApprovedQuantity] = useState<number>(1);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string>('');
  const [allowOverCredit, setAllowOverCredit] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadInitialData = async () => {
    try {
      const [empRes, clientRes] = await Promise.all([
        userService.listEmployees({ pageSize: 100 }),
        clientService.listClients({ pageSize: 100 }),
      ]);
      setEmployees(empRes.data || []);
      setClients(clientRes.data || []);
    } catch {
      // Handled
    }
  };

  const loadApprovals = async () => {
    setIsLoading(true);
    try {
      const data = await contentAndApprovalService.getPendingApprovals({
        type: filters.type !== 'ALL' ? filters.type : undefined,
        search: filters.search || undefined,
        clientId: filters.clientId || undefined,
        submittedById: filters.submittedById || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setApprovalsData(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [
    filters.type,
    filters.search,
    filters.clientId,
    filters.submittedById,
    filters.dateRange,
    filters.startDate,
    filters.endDate,
  ]);

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.type && filters.type !== 'ALL') {
      list.push({ key: 'type', label: 'Type', value: filters.type.replace('_', ' ') });
    }
    if (filters.clientId) {
      const c = clients.find((client) => client.id === filters.clientId);
      list.push({ key: 'clientId', label: 'Client', value: filters.clientId, displayValue: c?.companyName });
    }
    if (filters.submittedById) {
      const u = employees.find((emp) => emp.id === filters.submittedById);
      list.push({ key: 'submittedById', label: 'Author', value: filters.submittedById, displayValue: u?.fullName });
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
  }, [filters, clients, employees]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dateRange') {
      setFilters({ dateRange: '', startDate: '', endDate: '' });
    } else {
      clearFilter(key);
    }
  };

  const handleInspect = (item: any) => {
    setSelectedItem(item);
    setFeedback('');
    if (item.type === 'TASK') {
      const rev = item.deliverableReview;
      const initialQty =
        rev?.suggestedApprovedQuantity !== undefined
          ? rev.suggestedApprovedQuantity
          : item.deliverableCount > 0
          ? item.deliverableCount
          : 1;
      setApprovedQuantity(initialQty);
      setSelectedDeliverableId(rev?.deliverableId || item.availableDeliverables?.[0]?.id || '');
      setAllowOverCredit(false);
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
      toast.error(`Unable to view attachment "${fileName}".`);
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

  const invalidateCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const handleApprove = async (item: any) => {
    setIsSubmitting(true);
    try {
      if (item.type === 'TASK') {
        await taskService.approveTaskDeliverables(item.id, {
          approvedQuantity: Number(approvedQuantity),
          feedback,
          deliverableId: selectedDeliverableId || undefined,
          allowOverCredit,
        });
        toast.success(
          `Task approved! Credited ${approvedQuantity} deliverable(s). Client package progress updated.`
        );
      }
      setSelectedItem(null);
      setFeedback('');
      loadApprovals();
      invalidateCaches();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to approve item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRevision = async (item: any) => {
    setIsSubmitting(true);
    try {
      if (item.type === 'TASK') {
        await taskService.rejectTask(item.id, {
          feedback: feedback || 'Please make the required revisions and resubmit at 100%.',
        });
        toast.success('Revision request sent to employee');
      }
      setSelectedItem(null);
      setFeedback('');
      loadApprovals();
      invalidateCaches();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to request revision');
    } finally {
      setIsSubmitting(false);
    }
  };


  const items = approvalsData?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centralized Approval Queue"
        description="Review and act on pending creative task deliverables and social media content."
      />

      {/* Queue Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'ALL', label: `All Queue (${approvalsData?.total || items.length})` },
          { key: 'TASK', label: `Tasks (${approvalsData?.counts?.tasks || 0})` },
          { key: 'CONTENT', label: `Content Pipeline (${approvalsData?.counts?.content || 0})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter('type', tab.key)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filters.type === tab.key
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
        totalResults={items.length}
        resultsLabel="pending items"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
      >
        <SearchInput
          placeholder="Search items, clients, or team members..."
          value={filters.search}
          onChange={(val) => setFilter('search', val)}
          className="w-full sm:w-64"
        />

        <FilterSelect
          label="Client"
          value={filters.clientId}
          onChange={(val) => setFilter('clientId', val)}
          options={clients.map((c) => ({ label: c.companyName, value: c.id }))}
        />

        <FilterSelect
          label="Submitted By"
          value={filters.submittedById}
          onChange={(val) => setFilter('submittedById', val)}
          options={employees.map((e) => ({ label: e.fullName, value: e.id }))}
        />
      </FilterToolbar>

      {/* Approval Cards List */}
      {isLoading ? (
        <LoadingState message="Loading approval queue..." />
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">
            {activeFiltersCount > 0 ? 'No items match your filter criteria' : 'Approval Queue is Clear!'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {activeFiltersCount > 0
              ? 'Try adjusting your filters or resetting to see all pending items.'
              : 'All submissions have been reviewed and approved.'}
          </p>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-4">
              Reset Filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => {
            const Icon = item.type === 'TASK' ? CheckSquare : Film;

            return (
              <Card
                key={`${item.type}-${item.id}`}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="p-3 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                        {item.type.replace('_', ' ')}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">{item.title}</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Client: <span className="font-semibold text-purple-700">{item.clientName}</span> • Submitted by:{' '}
                      <span className="font-semibold text-slate-800">{item.submittedByName}</span>
                    </p>

                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleInspect(item)}
                  >
                    Inspect & Act <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inspect & Review Modal */}
      {selectedItem && (
        <Modal
          isOpen={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
          title={`Review ${selectedItem.type.replace('_', ' ')}`}
          description={`Client: ${selectedItem.clientName} • Author: ${selectedItem.submittedByName}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Common Header Info */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900 text-sm">{selectedItem.title}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 uppercase">
                    {selectedItem.type.replace('_', ' ')}
                  </span>
                  <StatusBadge status={selectedItem.status} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600">
                <div>
                  <span className="text-slate-400">Client:</span>{' '}
                  <strong className="text-purple-700">{selectedItem.clientName}</strong>
                </div>
                {selectedItem.packageName && (
                  <div>
                    <span className="text-slate-400">Package:</span>{' '}
                    <strong className="text-slate-800">{selectedItem.packageName}</strong>
                  </div>
                )}
                {selectedItem.serviceName && (
                  <div>
                    <span className="text-slate-400">Service:</span>{' '}
                    <strong className="text-slate-800">{selectedItem.serviceName}</strong>
                  </div>
                )}
                <div>
                  <span className="text-slate-400">Author:</span>{' '}
                  <strong className="text-slate-800">{selectedItem.submittedByName}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Submitted:</span>{' '}
                  <span className="text-slate-700">{formatDateTime(selectedItem.submittedAt)}</span>
                </div>
                {selectedItem.completionPercentage !== undefined && (
                  <div>
                    <span className="text-slate-400">Task Progress:</span>{' '}
                    <strong className="text-emerald-700">{selectedItem.completionPercentage}%</strong>
                  </div>
                )}
              </div>
            </div>

            {/* TASK SPECIFIC: Agreed Deliverables & Package Progress Credit Section */}
            {selectedItem.type === 'TASK' && (() => {
              const rev = selectedItem.deliverableReview;
              const targetDeliverable =
                selectedItem.availableDeliverables?.find((d: any) => d.id === selectedDeliverableId) ||
                (rev ? {
                  id: rev.deliverableId,
                  name: rev.deliverableName,
                  quantity: rev.targetQuantity,
                  unit: rev.unit,
                  deliverableType: rev.deliverableType,
                  targetPeriod: rev.targetPeriod,
                } : null);

              const targetQty = targetDeliverable?.quantity ?? rev?.targetQuantity ?? 1;
              const unit = targetDeliverable?.unit || rev?.unit || 'units';
              const previouslyApproved = rev?.previouslyApproved ?? 0;
              const remainingQty = Math.max(0, targetQty - previouslyApproved);
              const deliverableType = targetDeliverable?.deliverableType || rev?.deliverableType || 'QUANTITY';
              const isOverTarget = (previouslyApproved + approvedQuantity) > targetQty;
              const previewPct = Math.min(100, Math.round(((previouslyApproved + approvedQuantity) / Math.max(1, targetQty)) * 100));

              return (
                <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200/80 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-700" />
                      Agreed Package Deliverables Credit
                    </h4>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded uppercase">
                      Type: {deliverableType}
                    </span>
                  </div>

                  {/* Deliverable Selector if multiple deliverables exist */}
                  {selectedItem.availableDeliverables && selectedItem.availableDeliverables.length > 1 && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Select Agreed Deliverable to Credit:
                      </label>
                      <select
                        value={selectedDeliverableId}
                        onChange={(e) => {
                          const newId = e.target.value;
                          setSelectedDeliverableId(newId);
                          const matched = selectedItem.availableDeliverables.find((d: any) => d.id === newId);
                          if (matched) {
                            setApprovedQuantity(matched.deliverableType === 'FEATURE' ? 1 : 1);
                          }
                        }}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-medium text-slate-800"
                      >
                        {selectedItem.availableDeliverables.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.quantity ? `${d.quantity} ${d.unit || 'units'}` : d.deliverableType})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {targetDeliverable && (
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">
                        Deliverable:{' '}
                        <span className="text-purple-800 font-extrabold">{targetDeliverable.name}</span>
                      </p>
                    </div>
                  )}

                  {/* Deliverable Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 bg-white rounded-lg border border-purple-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Agreed Target</span>
                      <span className="text-sm font-extrabold text-slate-900">
                        {targetQty} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-purple-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Prev Approved</span>
                      <span className="text-sm font-extrabold text-slate-700">
                        {previouslyApproved} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-purple-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Remaining</span>
                      <span className="text-sm font-extrabold text-purple-700">
                        {remainingQty} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-purple-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Progress After</span>
                      <span className="text-sm font-extrabold text-emerald-600">
                        {previewPct}%
                      </span>
                    </div>
                  </div>

                  {/* Quantity Input */}
                  {deliverableType !== 'FEATURE' ? (
                    <div className="p-3 bg-white rounded-lg border border-purple-200/80 space-y-2">
                      <label className="block text-xs font-bold text-slate-900">
                        Approved Quantity to Credit Now ({unit}):
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setApprovedQuantity((prev) => Math.max(0, prev - 1))}
                            className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={approvedQuantity}
                            onChange={(e) => setApprovedQuantity(Math.max(0, Number(e.target.value) || 0))}
                            className="w-20 text-center py-1.5 text-xs font-extrabold text-slate-900 border-x border-slate-300 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => setApprovedQuantity((prev) => prev + 1)}
                            className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs text-slate-600 font-medium">
                          {unit} will be marked completed for <strong>{selectedItem.clientName}</strong>
                        </span>
                      </div>

                      {/* Over-credit warning */}
                      {isOverTarget && (
                        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-amber-800">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            Over-credit Warning
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            Crediting <strong>{approvedQuantity} {unit}</strong> plus previously approved ({previouslyApproved}) exceeds the agreed target of <strong>{targetQty} {unit}</strong> (remaining: {remainingQty}).
                          </p>
                          <label className="flex items-center gap-2 pt-1 cursor-pointer font-bold text-[11px] text-amber-950">
                            <input
                              type="checkbox"
                              checked={allowOverCredit}
                              onChange={(e) => setAllowOverCredit(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500"
                            />
                            Confirm and authorize target override
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded-lg border border-purple-200/80 text-xs text-slate-700">
                      Feature deliverable will be marked <strong>Completed (100%)</strong> upon approval.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Proof of Work & Attachments Section */}
            {selectedItem.type === 'TASK' && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                  Proof of Work & Attachments ({selectedItem.attachments?.length || 0})
                </h4>

                {selectedItem.attachments && selectedItem.attachments.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {selectedItem.attachments.map((att: any) => (
                      <div
                        key={att.id || att.name}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate" title={att.name}>
                              {att.name}
                            </p>
                            <span className="text-[10px] text-slate-500">
                              {att.uploadedBy ? `Uploaded by ${att.uploadedBy} • ` : ''}
                              {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB • ` : ''}
                              {att.createdAt ? formatDateTime(att.createdAt) : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewAttachment(selectedItem.id, att.id, att.name, att.fileType)}
                            className="text-xs py-1 px-2.5 h-7"
                          >
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadAttachment(selectedItem.id, att.id, att.name, att.fileType)}
                            className="text-xs py-1 px-2.5 h-7"
                          >
                            <Download className="w-3 h-3 mr-1" /> Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200 text-center">
                    No proof files uploaded for this task.
                  </p>
                )}
              </div>
            )}

            {/* Submission Content / Description */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                {selectedItem.type === 'TASK' ? 'Task Description & Instructions' : 'Submission Content & Details'}
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                {selectedItem.description || 'No detailed description provided.'}
              </p>
            </div>

            {/* Reviewer Feedback Input */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Reviewer Feedback & Notes
              </label>
              <Textarea
                placeholder="Enter feedback or revision requirements..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedItem(null)}>
                Cancel
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRequestRevision(selectedItem)}
                  isLoading={isSubmitting}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Request Revision
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleApprove(selectedItem)}
                  isLoading={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  {selectedItem.type === 'TASK' ? 'Approve Task & Credit Deliverables' : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


