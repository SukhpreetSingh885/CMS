import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dailyReportService, clientService, taskService } from '../../services';
import { Client, Task } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { LoadingState } from '../../components/common/LoadingState';
import { Send, Upload, FileText, CheckCircle2, Clock, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';

const reportSchema = z.object({
  clientId: z.string().min(1, 'Please select an assigned client'),
  serviceId: z.string().optional(),
  taskId: z.string().optional(),
  workCompleted: z.string().min(3, 'Description of work completed is required'),
  quantity: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0, 'Quantity cannot be negative').optional()
  ),
  unit: z.string().optional(),
  workDescription: z.string().optional(),
  hoursSpent: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0, 'Hours spent cannot be negative').optional()
  ),
  workPending: z.string().optional(),
  issuesOrBlockers: z.string().optional(),
  nextAction: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

const COMMON_UNITS = [
  'pages',
  'posts',
  'creatives',
  'reels',
  'hours',
  'articles',
  'features',
  'keywords',
  'campaigns',
  'videos',
  'screens',
];

export const DailyReportSubmit: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('clientId') || '';
  const preselectedTaskId = searchParams.get('taskId') || '';

  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      clientId: preselectedClientId,
      taskId: preselectedTaskId,
      hoursSpent: 4,
    },
  });

  const selectedClientId = watch('clientId');

  // Keep live time ticking for submission timestamp display
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadFormData = async () => {
      setIsLoading(true);
      try {
        const [cRes, tRes] = await Promise.all([
          clientService.getMyClients({ pageSize: 100 }),
          taskService.getMyTasks({ pageSize: 100 }),
        ]);
        const assignedClients = cRes.data || [];
        setClients(assignedClients);
        setAllTasks(tRes.data || []);

        if (preselectedClientId) {
          setValue('clientId', preselectedClientId);
        }
        if (preselectedTaskId) {
          setValue('taskId', preselectedTaskId);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadFormData();
  }, [preselectedClientId, preselectedTaskId, setValue]);

  // Selected client object
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId);
  }, [clients, selectedClientId]);

  // Services available for selected client and assigned to this employee
  const availableServices = useMemo(() => {
    if (!selectedClient || !Array.isArray(selectedClient.services)) return [];
    return selectedClient.services.filter((svc: any) => {
      if (!user) return true;
      if (user.role === 'ADMIN') return true;
      const isLead = svc.assignedEmployeeId === user.id;
      const isTeam = Array.isArray(svc.assignedEmployees) &&
        svc.assignedEmployees.some((ae: any) => (ae.employeeId || ae.employee?.id) === user.id);
      return isLead || isTeam || true; // allow all client purchased services if assigned to client
    });
  }, [selectedClient, user]);

  // Tasks belonging to this client and assigned to this employee
  const clientTasks = useMemo(() => {
    if (!selectedClientId) return [];
    return allTasks.filter((t) => t.clientId === selectedClientId);
  }, [allTasks, selectedClientId]);

  // Auto-populate service when task is chosen
  const handleTaskChange = (taskId: string) => {
    setValue('taskId', taskId);
    if (!taskId) return;
    const task = clientTasks.find((t) => t.id === taskId);
    if (task?.serviceId) {
      setValue('serviceId', task.serviceId);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ReportFormValues) => {
    setIsSubmitting(true);
    try {
      // 1. Create client work report
      const payload: any = {
        clientId: data.clientId,
        serviceId: data.serviceId || null,
        taskId: data.taskId || null,
        workCompleted: data.workCompleted.trim(),
        workDescription: data.workDescription?.trim() || data.workCompleted.trim(),
        quantity: data.quantity !== undefined && data.quantity !== null ? Number(data.quantity) : null,
        unit: data.unit?.trim() || null,
        hoursSpent: data.hoursSpent !== undefined && data.hoursSpent !== null ? Number(data.hoursSpent) : 0,
        workPending: data.workPending?.trim() || null,
        issuesOrBlockers: data.issuesOrBlockers?.trim() || null,
        nextAction: data.nextAction?.trim() || null,
        isDraft: false,
      };

      const report = await dailyReportService.createReport(payload);

      // 2. Upload attachments if provided
      if (selectedFiles.length > 0 && report?.id) {
        for (const file of selectedFiles) {
          try {
            await dailyReportService.uploadAttachment(report.id, file);
          } catch {
            // Non-blocking attachment upload
          }
        }
      }

      toast.success('Client work report submitted successfully!');
      reset();
      setSelectedFiles([]);
      navigate('/employee/my-reports');
    } catch (err: any) {
      // Handled by API error interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading client reporting form..." />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Submit Client Work Report"
        description="Report work completed, deliverables output, and hours for your assigned client account."
      />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Top Banner: Timestamp & Client Context */}
          <div className="p-3.5 bg-purple-50/70 border border-purple-200/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-purple-900 font-semibold">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>Submission Time:</span>
              <span className="font-mono text-purple-800">
                {currentTime.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                —{' '}
                {currentTime.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>
            <div className="text-[11px] text-purple-700 bg-white/80 px-2.5 py-1 rounded-md border border-purple-200">
              Multiple reports permitted per client on the same day
            </div>
          </div>

          {/* Core Selection Row: Client, Service, Task */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Required Client Account */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1.5">
                Client Account <span className="text-rose-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 font-medium"
                {...register('clientId')}
              >
                <option value="">Select Assigned Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
              {errors.clientId && (
                <p className="text-xs text-rose-500 mt-1">{errors.clientId.message}</p>
              )}
            </div>

            {/* Optional Service Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Service (Optional)
              </label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50 disabled:text-slate-400"
                disabled={!selectedClientId}
                {...register('serviceId')}
              >
                <option value="">
                  {selectedClientId ? 'None / All Services' : 'Select client first'}
                </option>
                {availableServices.map((cs: any) => (
                  <option key={cs.serviceId || cs.id} value={cs.serviceId}>
                    {cs.service?.name || cs.name || 'Service'}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Task Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Related Task (Optional)
              </label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50 disabled:text-slate-400"
                disabled={!selectedClientId}
                value={watch('taskId') || ''}
                onChange={(e) => handleTaskChange(e.target.value)}
              >
                <option value="">
                  {selectedClientId ? 'None / General Client Work' : 'Select client first'}
                </option>
                {clientTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity, Unit, and Work Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Deliverable Quantity (Optional)
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 4, 10, 1.5"
                error={errors.quantity?.message}
                {...register('quantity')}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Numerical quantity delivered (if applicable)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Deliverable Unit (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. pages, posts, reels, hours"
                list="common-units-list"
                error={errors.unit?.message}
                {...register('unit')}
              />
              <datalist id="common-units-list">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Universal unit (not hardcoded to any service)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Hours Spent (Optional)
              </label>
              <Input
                type="number"
                step="0.25"
                min="0"
                placeholder="e.g. 3.5"
                error={errors.hoursSpent?.message}
                {...register('hoursSpent')}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Time dedicated to this specific report
              </span>
            </div>
          </div>

          {/* Required Work Completed Summary */}
          <div>
            <Textarea
              label="Work Completed / Deliverable Output *"
              placeholder="Detail the exact work completed for this client (e.g. 'Designed 4 homepage and about section responsive web pages', 'Created 3 reel creatives for summer campaign', 'Conducted keyword research and resolved 404 crawl errors')..."
              error={errors.workCompleted?.message}
              rows={3}
              {...register('workCompleted')}
            />
          </div>

          {/* Detailed Context / Strategy */}
          <div>
            <Textarea
              label="Detailed Description & Context (Optional)"
              placeholder="Explain technical approach, Figma links, campaign target audience, design rationale, or testing findings..."
              error={errors.workDescription?.message}
              rows={2}
              {...register('workDescription')}
            />
          </div>

          {/* Pending Steps & Blockers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Textarea
              label="Next Steps / Pending Work (Optional)"
              placeholder="What tasks or next deliverables carry forward for this client?"
              rows={2}
              {...register('workPending')}
            />

            <Textarea
              label="Issues, Blockers, or Needs (Optional)"
              placeholder="Any dependencies, missing client assets, API keys, or approval delays?"
              rows={2}
              {...register('issuesOrBlockers')}
            />
          </div>

          {/* Proof of Work & Attachments */}
          <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-purple-600" /> Attachments & Proof of Work (Optional)
                </p>
                <p className="text-[11px] text-slate-500">
                  Upload screenshots, exports, PDFs, mockups, or reports as proof of completion.
                </p>
              </div>

              <label className="cursor-pointer">
                <span className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg inline-flex items-center gap-1 transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Select Files
                </span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {selectedFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400">({Math.round(f.size / 1024)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/employee/my-reports')}
            >
              Cancel
            </Button>

            <Button type="submit" size="sm" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Client Report
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
