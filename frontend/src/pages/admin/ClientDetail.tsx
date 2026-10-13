import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Instagram,
  CheckSquare,
  FileText,
  Calendar,
  Layers,
  Receipt,
  MessageSquare,
  FolderClosed,
  Plus,
  Clock,
  Send,
  Video,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  Printer,
  Trash2,
  AlertTriangle,
  Users,
  Search,
  Check,
  X,
  UserPlus,
} from 'lucide-react';
import { clientService, meetingAndCommsService, taskService, financeService, userService } from '../../services';
import { Client, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { formatINR, formatDate, formatDateTime } from '../../utils/formatters';
import { toast } from 'sonner';

export const ClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const initialTabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'services' | 'tasks' | 'content' | 'meetings' | 'comms' | 'files' | 'finance' | 'renewals'
  >(
    initialTabParam === 'services' || initialTabParam === 'tasks'
      ? initialTabParam
      : 'overview'
  );

  // Manage Service Team Modal states
  const [activeEmployees, setActiveEmployees] = useState<User[]>([]);
  const [managingService, setManagingService] = useState<any | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isSavingTeam, setIsSavingTeam] = useState(false);

  // Inline Create Task Modal states (Stage 3: Task creation after employee assignment)
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskForm, setTaskForm] = useState<{
    serviceId: string;
    assignedToId: string;
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    deliverableId?: string;
    deliverableName?: string;
    deliverableCount?: number;
  }>({
    serviceId: '',
    assignedToId: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    deliverableId: '',
    deliverableName: '',
    deliverableCount: 1,
  });

  // Permanent Client Deletion Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  // Safe Task Deletion Modal states
  const [taskToDelete, setTaskToDelete] = useState<any | null>(null);
  const [deleteTaskConfirmText, setDeleteTaskConfirmText] = useState('');
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'services' || tabParam === 'tasks' || tabParam === 'overview') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const getServiceTeam = (svc: any): any[] => {
    if (!svc) return [];
    if (Array.isArray(svc.assignedEmployees) && svc.assignedEmployees.length > 0) {
      return svc.assignedEmployees.map((ae: any) => ae.employee).filter(Boolean);
    }
    if (svc.assignedEmployee) {
      return [svc.assignedEmployee];
    }
    return [];
  };

  const loadClient = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await clientService.getClientById(id);
      setClient(res);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveEmployees = async () => {
    if (!isAdmin) return;
    try {
      const res = await userService.listEmployees({ status: 'ACTIVE', pageSize: 100 });
      setActiveEmployees((res.data || []).filter((e: User) => e.status === 'ACTIVE'));
    } catch {
      // Non-blocking
    }
  };

  const handleOpenManageTeam = (svc: any) => {
    const existingIds: string[] = [];
    if (Array.isArray(svc.assignedEmployees) && svc.assignedEmployees.length > 0) {
      svc.assignedEmployees.forEach((ae: any) => {
        const empId = ae.employee?.id || ae.employeeId;
        if (empId && !existingIds.includes(empId)) existingIds.push(empId);
      });
    } else if (svc.assignedEmployee?.id) {
      existingIds.push(svc.assignedEmployee.id);
    } else if (svc.assignedEmployeeId) {
      existingIds.push(svc.assignedEmployeeId);
    }
    setManagingService(svc);
    setSelectedEmployeeIds(existingIds);
    setEmployeeSearch('');
  };

  const handleOpenCreateTaskModal = (preselectedClientService?: any) => {
    const servicesList = client?.services || [];
    const targetClientSvc = preselectedClientService || servicesList[0] || null;
    const team = getServiceTeam(targetClientSvc);
    setTaskForm({
      serviceId: targetClientSvc?.serviceId || '',
      assignedToId: team[0]?.id || '',
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      deliverableId: '',
      deliverableName: '',
      deliverableCount: 1,
    });
    setIsCreateTaskOpen(true);
  };

  const handleCreateClientTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    if (!taskForm.serviceId) {
      toast.error('Please select a purchased service for this task');
      return;
    }
    if (!taskForm.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    if (!taskForm.assignedToId) {
      toast.error('Please select an assigned employee from the service team');
      return;
    }

    setIsCreatingTask(true);
    try {
      await taskService.createTask({
        clientId: client.id,
        serviceId: taskForm.serviceId,
        assignedToId: taskForm.assignedToId,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate,
        startDate: new Date().toISOString().slice(0, 10),
        deliverableId: taskForm.deliverableId || null,
        deliverableName: taskForm.deliverableName || null,
        deliverableCount: taskForm.deliverableCount !== undefined ? Number(taskForm.deliverableCount) : 0,
      });
      toast.success('Task created and assigned successfully');
      setIsCreateTaskOpen(false);
      await loadClient();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    const attCount = taskToDelete.attachments?.length || (taskToDelete._count?.attachments ?? 0);
    const commCount = taskToDelete.comments?.length || (taskToDelete._count?.comments ?? 0);
    const isCompleted = ['COMPLETED', 'DELIVERED', 'APPROVED'].includes(taskToDelete.status);
    const hasSensitiveData = attCount > 0 || commCount > 0 || isCompleted;

    if (hasSensitiveData && deleteTaskConfirmText.trim().toUpperCase() !== 'DELETE') {
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
      setDeleteTaskConfirmText('');
      await loadClient();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete task');
    } finally {
      setIsDeletingTask(false);
    }
  };

  const handleToggleEmployee = (empId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSaveServiceTeam = async () => {
    if (!client || !managingService) return;
    setIsSavingTeam(true);
    try {
      const updatedService = await clientService.updateClientServiceTeam(
        client.id,
        managingService.id,
        selectedEmployeeIds
      );
      setClient((prev: any) => ({
        ...prev,
        services: (prev.services || []).map((s: any) =>
          s.id === managingService.id ? updatedService : s
        ),
      }));
      toast.success(
        `Updated team for ${managingService.service?.name || 'Service'} (${selectedEmployeeIds.length} assigned)`
      );
      setManagingService(null);
      loadClient();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update service team');
    } finally {
      setIsSavingTeam(false);
    }
  };

  const handleDeleteClientPermanent = async () => {
    if (!client) return;
    const trimmed = deleteConfirmText.trim();
    if (trimmed !== 'DELETE' && trimmed.toLowerCase() !== client.companyName.trim().toLowerCase()) {
      toast.error(`Please type "DELETE" or "${client.companyName}" to confirm deletion`);
      return;
    }

    setIsDeletingClient(true);
    try {
      const res = await clientService.deleteClientPermanent(client.id, { confirmation: trimmed });
      toast.success(res.message || `Client "${client.companyName}" permanently deleted`);
      setIsDeleteModalOpen(false);
      window.dispatchEvent(new CustomEvent('finance-data-updated'));
      navigate('/admin/clients');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete client');
    } finally {
      setIsDeletingClient(false);
    }
  };

  useEffect(() => {
    loadClient();
    loadActiveEmployees();
  }, [id, isAdmin]);

  if (isLoading) {
    return <LoadingState message="Loading client 360 profile..." />;
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-base font-bold text-slate-800">Client not found</h3>
        <Link to="/admin/clients" className="mt-3 inline-block">
          <Button size="sm">Back to Clients</Button>
        </Link>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'services', label: `Services (${client.services?.length || 0})` },
    { key: 'tasks', label: `Tasks (${client.tasks?.length || 0})` },
    { key: 'content', label: `Content (${client.contentItems?.length || 0})` },
    { key: 'comms', label: `Comms (${client.communications?.length || 0})` },
    { key: 'meetings', label: `Meetings (${client.meetings?.length || 0})` },
    { key: 'files', label: `Documents (${client.files?.length || 0})` },
    ...(isAdmin
      ? [
          { key: 'finance', label: `Invoices (${client.invoices?.length || 0})` },
          { key: 'renewals', label: 'Renewals' },
        ]
      : []),
  ];

  const hasAnyServiceTeamAssigned = (client.services || []).some(
    (s: any) => getServiceTeam(s).length > 0
  );

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Profile Header */}
      <div>
        <Link
          to={isAdmin ? '/admin/clients' : '/employee/clients'}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to all clients
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 font-bold text-lg flex items-center justify-center border border-purple-200 shrink-0">
              {client.companyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-extrabold text-slate-900">{client.companyName}</h1>
                <StatusBadge status={client.status} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {client.industry || 'Client'} • Onboarded on {formatDate(client.onboardingDate)}
              </p>
            </div>
          </div>

          {/* Quick Metrics & Actions in Header */}
          <div className="flex flex-wrap items-center gap-5 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
            {isAdmin && client.packagePricing !== undefined && (
              <div className="text-right">
                <span className="text-[11px] text-slate-400 font-medium">
                  {client.billingCycle === 'ONE_TIME' ? 'Project Price' : 'Monthly Retainer'}
                </span>
                <p className="text-base font-extrabold text-slate-900">
                  {formatINR(client.packagePricing)}
                  {client.billingCycle === 'ONE_TIME' ? (
                    <span className="text-[11px] text-amber-700 font-semibold ml-1">one-time</span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-normal ml-0.5">/mo</span>
                  )}
                </p>
              </div>
            )}

            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-medium">Delivery Completion</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-20 bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${client.deliveryProgress || 0}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-800">{client.deliveryProgress || 0}%</span>
              </div>
            </div>

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteConfirmText('');
                  setIsDeleteModalOpen(true);
                }}
                className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200 px-3 py-1.5 flex items-center gap-1.5"
                title="Permanently delete client and all related data"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Delete Client & Related Data
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Growth Goals & Strategy</CardTitle>
              </CardHeader>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {client.clientGoals || 'No strategic goals documented yet.'}
              </p>
            </Card>

            {/* Assigned Services Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Active Deliverable Deliveries</CardTitle>
              </CardHeader>
              <div className="divide-y divide-slate-100">
                {client.services?.map((svc: any) => {
                  const target = svc.monthlyTarget || 1;
                  const completed = svc.completedDeliverables || 0;
                  const pct = Math.min(100, Math.round((completed / target) * 100));
                  const team = Array.isArray(svc.assignedEmployees) && svc.assignedEmployees.length > 0
                    ? svc.assignedEmployees.map((ae: any) => ae.employee).filter(Boolean)
                    : svc.assignedEmployee
                    ? [svc.assignedEmployee]
                    : [];

                  return (
                    <div key={svc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900">{svc.service?.name}</p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              team.length > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {team.length > 0 ? `Assigned (${team.length})` : 'Not Assigned'}
                          </span>
                        </div>

                        {team.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {team.map((emp: any) => (
                              <span
                                key={emp.id}
                                className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                              >
                                <span className="font-semibold text-slate-900">{emp.fullName}</span>
                                {emp.designation && (
                                  <span className="text-[10px] text-slate-500">— {emp.designation}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-1 italic">No employees assigned yet</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-700">
                          {completed} / {target} done
                        </span>
                        <div className="w-24 bg-slate-100 rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenManageTeam(svc)}
                            className="text-[11px] px-2.5 py-1 flex items-center gap-1"
                          >
                            <Users className="w-3 h-3 text-purple-600" />
                            {team.length > 0 ? 'Manage Team' : 'Assign Employees'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Sidebar Contact & Contract Card */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Details</CardTitle>
              </CardHeader>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{client.email}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{client.mobileNumber}</span>
                </div>
                {client.website && (
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <a href={client.website} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
                      {client.website}
                    </a>
                  </div>
                )}
                {client.instagram && (
                  <div className="flex items-center gap-2.5">
                    <Instagram className="w-4 h-4 text-slate-400" />
                    <span>{client.instagram}</span>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contract Information</CardTitle>
              </CardHeader>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Package:</span>
                  <span className="font-semibold text-purple-700">{client.package?.name || 'Custom'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Billing Type:</span>
                  <span className="font-semibold text-slate-800">
                    {client.billingCycle === 'ONE_TIME'
                      ? 'One-Time Project'
                      : client.billingCycle === 'QUARTERLY'
                      ? 'Quarterly Retainer'
                      : client.billingCycle === 'YEARLY' || client.billingCycle === 'ANNUALLY'
                      ? 'Yearly Retainer'
                      : 'Monthly Retainer'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Contract Start:</span>
                  <span>{formatDate(client.contractStartDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {client.billingCycle === 'ONE_TIME' ? 'Project Deadline:' : 'Contract End:'}
                  </span>
                  <span>{formatDate(client.contractEndDate)}</span>
                </div>
                {client.billingCycle !== 'ONE_TIME' && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Renewal Date:</span>
                    <span className="font-bold text-slate-900">{formatDate(client.renewalDate)}</span>
                  </div>
                )}
              </div>
            </Card>

            {isAdmin && client.contractSnapshot && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5 text-purple-900">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Agreed Contract Snapshot
                  </CardTitle>
                </CardHeader>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="font-bold text-slate-900">{client.contractSnapshot.packageName}</p>
                    <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                      {formatINR(client.contractSnapshot.agreedPrice || client.contractSnapshot.basePrice)}
                      {client.contractSnapshot.setupFee > 0 ? ` + ${formatINR(client.contractSnapshot.setupFee)} Setup Fee` : ''}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Captured at onboarding: {client.contractSnapshot.capturedAt ? formatDate(client.contractSnapshot.capturedAt) : 'Frozen'}
                    </p>
                  </div>

                  {Array.isArray(client.contractSnapshot.services) && client.contractSnapshot.services.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Agreed Scope Deliverables
                      </span>
                      {client.contractSnapshot.services.map((cs: any, idx: number) => (
                        <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-100">
                          <p className="font-semibold text-slate-800 text-[11px]">{cs.serviceName}</p>
                          {cs.deliverablesSummary ? (
                            <p className="text-[10px] text-slate-500 mt-0.5">{cs.deliverablesSummary}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: SERVICES */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          {isAdmin && !hasAnyServiceTeamAssigned && (client.services?.length || 0) > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    No Service Teams Assigned Yet
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Assign employees to each purchased service below so they can view {client.companyName} in their dashboard and receive tasks.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleOpenManageTeam(client.services[0])}
                className="shrink-0 flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" /> Assign Employees
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Assigned Services & Team Allocations</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign one or multiple specialist employees to each purchased client service, then create service tasks.
                </p>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Assignment Status</th>
                    <th className="py-3 px-4">Assigned Employees & Roles</th>
                    <th className="py-3 px-4">
                      {client.billingCycle === 'ONE_TIME' ? 'Total Project Target' : 'Monthly Target'}
                    </th>
                    <th className="py-3 px-4">Completed</th>
                    <th className="py-3 px-4">Delivery %</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {client.services?.map((s: any) => {
                    const target = s.monthlyTarget || 1;
                    const completed = s.completedDeliverables || 0;
                    const pct = Math.min(100, Math.round((completed / target) * 100));
                    const team = getServiceTeam(s);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{s.service?.name}</p>
                          {s.deliverables && (
                            <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs truncate" title={s.deliverables}>
                              {s.deliverables}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                              team.length > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {team.length > 0 ? `Assigned (${team.length})` : 'Not Assigned'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {team.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {team.map((emp: any) => (
                                <div
                                  key={emp.id}
                                  className="inline-flex items-center gap-1.5 bg-purple-50/70 text-slate-800 px-2.5 py-1 rounded-lg border border-purple-200/70"
                                >
                                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {emp.fullName?.charAt(0).toUpperCase()}
                                  </span>
                                  <div>
                                    <span className="font-semibold text-slate-900">{emp.fullName}</span>
                                    {emp.designation && (
                                      <span className="text-[10px] text-purple-700 font-medium ml-1">
                                        — {emp.designation}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No employees assigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono">{target}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-purple-700">{completed}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{pct}%</span>
                            <div className="w-20 bg-slate-100 rounded-full h-1.5">
                              <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              {team.length === 0 ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenManageTeam(s)}
                                  className="text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
                                >
                                  <UserPlus className="w-3.5 h-3.5" /> Assign Employees
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenManageTeam(s)}
                                    className="text-xs px-3 py-1.5 inline-flex items-center gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
                                  >
                                    <Users className="w-3.5 h-3.5" /> Manage Team
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenCreateTaskModal(s)}
                                    className="text-xs px-3 py-1.5 inline-flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Create Task
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: TASKS */}
      {activeTab === 'tasks' && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Client Tasks</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign actionable deliverables to employees on this client's service teams.
              </p>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => handleOpenCreateTaskModal()}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Create Task
              </Button>
            )}
          </CardHeader>

          {(!client.tasks || client.tasks.length === 0) ? (
            <div className="p-10 text-center space-y-3 border-t border-slate-100">
              <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                No tasks created yet. Assign employees to the client's services, then create tasks.
              </p>
              {isAdmin && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  {!hasAnyServiceTeamAssigned && (client.services?.length || 0) > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveTab('services');
                        handleOpenManageTeam(client.services[0]);
                      }}
                    >
                      Assign Employees
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleOpenCreateTaskModal()}>
                    Create Task
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Task Title</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Assigned To</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Progress</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {client.tasks?.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{t.title}</div>
                        {t.deliverableName ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded mt-1">
                            Deliverable: {t.deliverableName} ({t.deliverableCount || 1})
                          </span>
                        ) : t.deliverableCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-normal text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded mt-1">
                            General Task
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-purple-700 font-medium">
                        {t.service?.name || 'General'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {t.assignedTo?.fullName}
                        {t.assignedTo?.designation && (
                          <span className="text-[10px] text-slate-500 ml-1">
                            — {t.assignedTo.designation}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={t.priority || 'MEDIUM'} />
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(t.dueDate)}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={t.status} />
                        {t.startedAt ? (
                          <span className="block text-[10px] text-slate-400 mt-1">
                            Started: {formatDateTime(t.startedAt)}
                          </span>
                        ) : (t.status === 'COMPLETED' || t.status === 'APPROVED' || t.status === 'DELIVERED') ? (
                          <span className="block text-[10px] text-emerald-600 mt-1 font-medium">
                            Completed (Legacy Record)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 font-bold text-purple-600">{t.completionPercentage}%</td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTaskToDelete(t);
                              setDeleteTaskConfirmText('');
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB CONTENT: INVOICES & PAYMENTS */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {/* Financial Summary */}
          {(() => {
            const totalInvoiced = client.invoices?.reduce((s: number, i: any) => s + Number(i.invoiceAmount), 0) || 0;
            const totalPaid = client.invoices?.reduce((s: number, i: any) => s + Number(i.amountPaid), 0) || 0;
            const totalBalance = client.invoices?.reduce((s: number, i: any) => s + Number(i.remainingBalance), 0) || 0;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Total Invoiced</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">{formatINR(totalInvoiced)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Total Collected</span>
                  <p className="text-xl font-bold text-emerald-600 mt-1">{formatINR(totalPaid)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Pending Balance</span>
                  <p className="text-xl font-bold text-rose-600 mt-1">{formatINR(totalBalance)}</p>
                </div>
              </div>
            );
          })()}

          <Card className="p-0 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Project Invoices & Installments</h3>
                <p className="text-xs text-slate-500">Agreed project pricing with installment tracking</p>
              </div>
              <Link to="/admin/invoices">
                <Button size="sm">Manage Invoices</Button>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Agreed Total</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Balance</th>
                    <th className="py-3 px-4">Paid %</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Installments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!client.invoices || client.invoices.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No invoices found for this client.
                      </td>
                    </tr>
                  ) : (
                    client.invoices.map((inv: any) => {
                      const percent = Number(inv.invoiceAmount) > 0
                        ? Math.min(100, Math.round((Number(inv.amountPaid) / Number(inv.invoiceAmount)) * 100))
                        : 0;
                      const isExpanded = expandedInvoiceId === inv.id;

                      return (
                        <React.Fragment key={inv.id}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-purple-700">{inv.invoiceNumber}</td>
                            <td className="py-3 px-4 text-slate-500">{formatDate(inv.dueDate)}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{formatINR(inv.invoiceAmount)}</td>
                            <td className="py-3 px-4 font-semibold text-emerald-600">{formatINR(inv.amountPaid)}</td>
                            <td className="py-3 px-4 font-bold text-rose-600">{formatINR(inv.remainingBalance)}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${percent >= 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-purple-600' : 'bg-slate-300'}`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-[10px] text-slate-600">{percent}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <StatusBadge status={inv.paymentStatus} />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await financeService.downloadInvoicePdf(inv.id, `Viralstan_Invoice_${inv.invoiceNumber}.pdf`);
                                      toast.success(`Downloaded PDF for ${inv.invoiceNumber}`);
                                    } catch (err: any) {
                                      toast.error(err.response?.data?.message || 'Failed to download PDF');
                                    }
                                  }}
                                  className="p-1 rounded text-purple-600 hover:bg-purple-50 hover:text-purple-800"
                                  title="Download PDF"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await financeService.printInvoicePdf(inv.id);
                                      toast.success(`Sent ${inv.invoiceNumber} to printer`);
                                    } catch (err: any) {
                                      toast.error(err.response?.data?.message || 'Failed to print');
                                    }
                                  }}
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                  title="Print Invoice"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 ml-1"
                                >
                                  {inv.payments?.length || 0} payments
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Nested Installment History Sub-Row */}
                          {isExpanded && (
                            <tr className="bg-purple-50/30">
                              <td colSpan={8} className="p-4">
                                <div className="space-y-2">
                                  <h4 className="text-xs font-bold text-slate-800">
                                    Installments Recorded for {inv.invoiceNumber}
                                  </h4>
                                  {(!inv.payments || inv.payments.length === 0) ? (
                                    <p className="text-xs text-slate-400 italic">No payments recorded yet for this invoice.</p>
                                  ) : (
                                    <div className="overflow-x-auto border border-purple-100 rounded-lg bg-white">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-purple-50 text-purple-900 font-semibold border-b border-purple-100">
                                          <tr>
                                            <th className="py-2 px-3">Date</th>
                                            <th className="py-2 px-3">Amount</th>
                                            <th className="py-2 px-3">Method</th>
                                            <th className="py-2 px-3">Transaction / UTR</th>
                                            <th className="py-2 px-3">Received By</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {inv.payments.map((p: any) => (
                                            <tr key={p.id}>
                                              <td className="py-2 px-3 text-slate-600">{formatDate(p.paymentDate)}</td>
                                              <td className="py-2 px-3 font-bold text-emerald-600">{formatINR(p.amount)}</td>
                                              <td className="py-2 px-3">
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                                  {p.paymentMethod}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 font-mono text-slate-700">{p.transactionReference || '-'}</td>
                                              <td className="py-2 px-3 text-slate-600">{p.receivedBy?.fullName || '-'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: COMMUNICATIONS */}
      {activeTab === 'comms' && (
        <Card>
          <CardHeader>
            <CardTitle>Client Interaction Log</CardTitle>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {client.communications?.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No logs found.</p>
            ) : (
              client.communications?.map((log: any) => (
                <div key={log.id} className="py-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase">
                      {log.type} • Logged by {log.loggedBy?.fullName}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatDateTime(log.date)}</span>
                  </div>
                  <p className="text-xs text-slate-700">{log.summary}</p>
                  {log.nextAction && (
                    <p className="text-[11px] text-purple-600 font-medium">Next Action: {log.nextAction}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB CONTENT: MEETINGS */}
      {activeTab === 'meetings' && (
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Meetings & Action Items</CardTitle>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {client.meetings?.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No meetings recorded.</p>
            ) : (
              client.meetings?.map((m: any) => (
                <div key={m.id} className="py-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900">{m.title}</h4>
                    <span className="text-xs font-semibold text-purple-700">{formatDateTime(m.meetingDateTime)}</span>
                  </div>
                  {m.agenda && <p className="text-xs text-slate-600">Agenda: {m.agenda}</p>}
                  {m.actionItems && <p className="text-xs text-slate-800 font-medium">Action items: {m.actionItems}</p>}
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB CONTENT: FILES */}
      {activeTab === 'files' && (
        <Card>
          <CardHeader>
            <CardTitle>Client Files & Assets</CardTitle>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {client.files?.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No documents uploaded.</p>
            ) : (
              client.files?.map((f: any) => (
                <div key={f.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FolderClosed className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{f.fileName}</p>
                      <p className="text-[10px] text-slate-400">Folder: {f.folder} • Uploaded by {f.uploadedBy?.fullName}</p>
                    </div>
                  </div>
                  <a
                    href={f.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-purple-600 hover:underline"
                  >
                    Download
                  </a>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB CONTENT: RENEWALS */}
      {activeTab === 'renewals' && (
        <Card>
          <CardHeader>
            <CardTitle>Contract Renewals</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {client.renewals?.map((r: any) => (
              <div key={r.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Renewal Date: {formatDate(r.renewalDate)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Amount: {formatINR(r.renewalAmount)}</p>
                </div>
                <StatusBadge status={r.renewalStatus} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Manage Service Team Modal */}
      {managingService && (
        <Modal
          isOpen={Boolean(managingService)}
          onClose={() => setManagingService(null)}
          title={`Manage Team — ${managingService.service?.name || 'Service'}`}
          description={`Assign one or multiple active employees to ${managingService.service?.name} for ${client.companyName}.`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Selected Team Chips */}
            <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                  Assigned Service Team ({selectedEmployeeIds.length})
                </span>
                {selectedEmployeeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeIds([])}
                    className="text-[11px] font-semibold text-rose-600 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {selectedEmployeeIds.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">
                  No employees selected. Select one or more employees below to assign them to this service.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEmployeeIds.map((empId) => {
                    const emp = activeEmployees.find((e) => e.id === empId);
                    if (!emp) return null;
                    return (
                      <span
                        key={emp.id}
                        className="inline-flex items-center gap-1.5 bg-white text-slate-900 px-2.5 py-1 rounded-lg border border-purple-200 shadow-2xs"
                      >
                        <span className="font-semibold">{emp.fullName}</span>
                        {emp.designation && (
                          <span className="text-[10px] text-purple-700">— {emp.designation}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleEmployee(emp.id)}
                          className="text-slate-400 hover:text-rose-600 ml-0.5"
                          title="Remove from service"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search active employees by name, role/designation, or department..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Active Employees Multi-Select List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
              {activeEmployees
                .filter((emp) => {
                  if (!employeeSearch.trim()) return true;
                  const q = employeeSearch.toLowerCase();
                  return (
                    emp.fullName.toLowerCase().includes(q) ||
                    (emp.designation || '').toLowerCase().includes(q) ||
                    (emp.department || '').toLowerCase().includes(q) ||
                    emp.email.toLowerCase().includes(q)
                  );
                })
                .map((emp) => {
                  const isSelected = selectedEmployeeIds.includes(emp.id);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleToggleEmployee(emp.id)}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-purple-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {emp.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {emp.fullName}
                            {emp.designation && (
                              <span className="ml-1.5 text-[11px] font-semibold text-purple-700">
                                — {emp.designation}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {emp.department ? `${emp.department} • ` : ''}
                            {emp.email}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}

              {activeEmployees.length === 0 && (
                <div className="p-6 text-center text-slate-400">
                  No active employees found.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setManagingService(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveServiceTeam}
                isLoading={isSavingTeam}
              >
                Save Team Assignment ({selectedEmployeeIds.length})
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Inline Create Task Modal (Stage 3: Create and Assign Tasks After Employee Assignment) */}
      {isCreateTaskOpen && (
        <Modal
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          title={`Create Task — ${client.companyName}`}
          description="Select a purchased service and assign a task to an employee on that service's team."
          maxWidth="lg"
        >
          {(() => {
            const selectedClientService = (client.services || []).find(
              (s: any) => s.serviceId === taskForm.serviceId
            );
            const selectedServiceTeam = getServiceTeam(selectedClientService);
            const modalDeliverablesList = Array.isArray(selectedClientService?.deliverablesConfig)
              ? selectedClientService.deliverablesConfig.filter((d: any) => d && d.isIncluded !== false)
              : [];

            return (
              <form onSubmit={handleCreateClientTask} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Client (Preselected)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={client.companyName}
                      className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Purchased Service *
                    </label>
                    <select
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                      value={taskForm.serviceId}
                      onChange={(e) => {
                        const nextServiceId = e.target.value;
                        const nextSvc = (client.services || []).find(
                          (s: any) => s.serviceId === nextServiceId
                        );
                        const nextTeam = getServiceTeam(nextSvc);
                        setTaskForm({
                          ...taskForm,
                          serviceId: nextServiceId,
                          assignedToId: nextTeam[0]?.id || '',
                          deliverableId: '',
                          deliverableName: '',
                          deliverableCount: 0,
                        });
                      }}
                    >
                      <option value="">Select Purchased Service...</option>
                      {(client.services || []).map((s: any) => {
                        const teamCount = getServiceTeam(s).length;
                        return (
                          <option key={s.id} value={s.serviceId}>
                            {s.service?.name} ({teamCount > 0 ? `${teamCount} assigned` : 'No team assigned'})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Target Agreed Deliverable (Optional) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Target Agreed Deliverable (Optional)
                    </label>
                    <select
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                      value={taskForm.deliverableId || ''}
                      onChange={(e) => {
                        const delivId = e.target.value;
                        const matched = modalDeliverablesList.find(
                          (d: any) => (d.id || d.deliverableId || d.name) === delivId
                        );
                        setTaskForm({
                          ...taskForm,
                          deliverableId: delivId,
                          deliverableName: matched ? (matched.name || matched.title) : '',
                          deliverableCount: matched ? (matched.quantity || 1) : 0,
                        });
                      }}
                    >
                      <option value="">General Task / No specific deliverable (0 Deliverables)</option>
                      {modalDeliverablesList.map((d: any) => {
                        const dId = d.id || d.deliverableId || d.name;
                        return (
                          <option key={dId} value={dId}>
                            {d.name || d.title} — {d.targetPeriod || 'Scope'} (Target: {d.quantity || 1} {d.unit || 'units'})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <Input
                      label="Units / Deliverables"
                      type="number"
                      min="0"
                      value={taskForm.deliverableCount ?? 0}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, deliverableCount: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>

                {/* Unassigned service warning banner */}
                {selectedClientService && selectedServiceTeam.length === 0 && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-medium text-amber-900">
                        No employees assigned to this service. Please assign a service team before creating employee tasks.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setIsCreateTaskOpen(false);
                        setActiveTab('services');
                        handleOpenManageTeam(selectedClientService);
                      }}
                      className="shrink-0 flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Assign Employees
                    </Button>
                  </div>
                )}

                <Input
                  label="Task Title *"
                  placeholder="e.g. Build Homepage UI, Technical SEO Audit, Design 5 Ad Creatives"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                />

                <Textarea
                  label="Task Description & Deliverable Notes"
                  placeholder="Provide instructions, reference links, or deliverable acceptance criteria..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Assign Employee (Service Team) *
                    </label>
                    <select
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                      value={taskForm.assignedToId}
                      onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}
                    >
                      <option value="">
                        {selectedServiceTeam.length > 0
                          ? 'Select Service Team Member...'
                          : 'No service team members assigned'}
                      </option>
                      {selectedServiceTeam.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName}
                          {emp.designation ? ` — ${emp.designation}` : ''}
                        </option>
                      ))}
                      {user && isAdmin && (
                        <option value={user.id}>
                          {user.fullName} (Self — Admin)
                        </option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Priority *
                    </label>
                    <select
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <Input
                    label="Due Date *"
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateTaskOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isCreatingTask}
                    disabled={!taskForm.serviceId || !taskForm.assignedToId || !taskForm.title.trim()}
                  >
                    Create & Assign Task
                  </Button>
                </div>
              </form>
            );
          })()}
        </Modal>
      )}

      {/* Permanent Client Deletion Modal */}
      {isDeleteModalOpen && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeleteConfirmText('');
          }}
          title={`Permanently Delete ${client.companyName}`}
          description="Admin Authorization Required: This action permanently removes this client and all associated client records."
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Warning Banner */}
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-900 text-xs">
                  Permanent Client & Related Data Purge
                </h4>
                <p className="text-rose-700 text-[11px] mt-0.5 leading-relaxed">
                  This action is irreversible. It will permanently delete this client along with all contracts, tasks, content deliverables, invoices, payments, meetings, communications, documents, and report records.
                </p>
                <p className="text-rose-900 text-[11px] font-semibold mt-1">
                  Shared Admin accounts, Employee accounts, Services Master records, and Package Templates will remain completely intact.
                </p>
              </div>
            </div>

            {/* Related Data Records Breakdown */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Client Data Breakdown To Be Purged:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Invoices</span>
                  <span className="text-sm font-extrabold text-slate-900">{client.invoices?.length || 0}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Payments</span>
                  <span className="text-sm font-extrabold text-emerald-600">{client.payments?.length || 0}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Tasks</span>
                  <span className="text-sm font-extrabold text-indigo-600">{client.tasks?.length || 0}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Deliverables</span>
                  <span className="text-sm font-extrabold text-purple-600">{client.contentItems?.length || 0}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Meetings</span>
                  <span className="text-sm font-extrabold text-slate-800">{client.meetings?.length || 0}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Comms Logs</span>
                  <span className="text-sm font-extrabold text-slate-800">{client.communications?.length || 0}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Documents</span>
                  <span className="text-sm font-extrabold text-slate-800">{client.files?.length || 0}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Services</span>
                  <span className="text-sm font-extrabold text-slate-800">{client.services?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Confirmation Input */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                To confirm permanent deletion, type <span className="font-mono font-bold text-rose-600">DELETE</span> or the client company name <span className="font-semibold text-slate-900">"{client.companyName}"</span> below:
              </label>
              <Input
                type="text"
                placeholder={`Type "DELETE" or "${client.companyName}"`}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="font-mono"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={isDeletingClient}
                disabled={
                  isDeletingClient ||
                  !(
                    deleteConfirmText.trim() === 'DELETE' ||
                    deleteConfirmText.trim().toLowerCase() === client.companyName.trim().toLowerCase()
                  )
                }
                onClick={handleDeleteClientPermanent}
                className="bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                Permanently Delete Client & All Data
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
            setDeleteTaskConfirmText('');
          }}
          title="Delete Task"
          description={`Permanently remove task #${taskToDelete.id.slice(-6).toUpperCase()} from the client.`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
              <p className="font-bold text-slate-900">{taskToDelete.title}</p>
              <p className="text-slate-600">
                Service: <span className="font-semibold">{taskToDelete.service?.name || 'General'}</span>
              </p>
              <p className="text-slate-600">
                Assignee: <span className="font-semibold">{taskToDelete.assignedTo?.fullName}</span>
              </p>
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
                    value={deleteTaskConfirmText}
                    onChange={(e) => setDeleteTaskConfirmText(e.target.value)}
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
                  setDeleteTaskConfirmText('');
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
                    deleteTaskConfirmText.trim().toUpperCase() !== 'DELETE'
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

