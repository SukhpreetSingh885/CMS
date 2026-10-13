import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { dailyReportService, clientService, taskService, packageService } from '../../services';
import { Client, Task, ServiceItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { LoadingState } from '../../components/common/LoadingState';
import { Send, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const reportSchema = z.object({
  reportDate: z.string().min(1, 'Date is required'),
  clientId: z.string().min(1, 'Please select client'),
  taskId: z.string().optional(),
  serviceId: z.string().optional(),
  workCompleted: z.string().min(5, 'Summary of completed work is required'),
  workDescription: z.string().min(5, 'Work description details are required'),
  workPending: z.string().optional(),
  hoursSpent: z.number().positive('Hours must be greater than 0'),
  issuesOrBlockers: z.string().optional(),
  nextAction: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

export const DailyReportSubmit: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportDate: new Date().toISOString().slice(0, 10),
      hoursSpent: 7.5,
    },
  });

  useEffect(() => {
    const loadFormData = async () => {
      setIsLoading(true);
      try {
        const [cRes, tRes, sRes] = await Promise.all([
          clientService.getMyClients({ pageSize: 100 }),
          taskService.getMyTasks({ pageSize: 100 }),
          packageService.listServices(),
        ]);
        setClients(cRes.data || []);
        setTasks(tRes.data || []);
        setServices(sRes || []);
      } finally {
        setIsLoading(false);
      }
    };
    loadFormData();
  }, []);

  const handleSave = async (data: ReportFormValues, isDraft: boolean) => {
    setIsSubmitting(true);
    try {
      await dailyReportService.createReport({
        ...data,
        hoursSpent: Number(data.hoursSpent),
        isDraft,
      });
      toast.success(isDraft ? 'Draft saved successfully' : 'Daily work report submitted for review!');
      navigate('/employee/my-reports');
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading daily reporting form..." />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Submit Daily Work Report"
        description="Document your daily work output, logged hours, completed deliverables, and next day plan."
      />

      <Card>
        <form onSubmit={handleSubmit((d) => handleSave(d, false))} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Report Date *"
              type="date"
              error={errors.reportDate?.message}
              {...register('reportDate')}
            />

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Client *</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                {...register('clientId')}
              >
                <option value="">Select Client Account</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
              {errors.clientId && <p className="text-xs text-rose-500 mt-1">{errors.clientId.message}</p>}
            </div>

            <Input
              label="Hours Spent Today *"
              type="number"
              step="0.5"
              error={errors.hoursSpent?.message}
              {...register('hoursSpent', { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Related Task (Optional)</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                {...register('taskId')}
              >
                <option value="">None / General Work</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.client?.companyName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Service Category (Optional)</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                {...register('serviceId')}
              >
                <option value="">None / General</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Textarea
            label="Work Completed Today (Deliverable Output) *"
            placeholder="Bullet point list of creatives designed, ad sets created, reels edited, copies written..."
            error={errors.workCompleted?.message}
            rows={3}
            {...register('workCompleted')}
          />

          <Textarea
            label="Detailed Work Description & Context *"
            placeholder="Explain campaign strategy, creative approach, testing details, or key insights..."
            error={errors.workDescription?.message}
            rows={3}
            {...register('workDescription')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Textarea
              label="Pending Work / Leftovers"
              placeholder="What tasks or exports carry over to tomorrow?"
              rows={2}
              {...register('workPending')}
            />

            <Textarea
              label="Issues or Blockers (If any)"
              placeholder="Waiting for client raw footage, brand kit assets, ad account access..."
              rows={2}
              {...register('issuesOrBlockers')}
            />
          </div>

          <Input
            label="Planned Next Action"
            placeholder="e.g. Render final 4K cut and upload to drive by 11 AM"
            {...register('nextAction')}
          />

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSubmit((d) => handleSave(d, true))}
              disabled={isSubmitting}
            >
              <Save className="w-3.5 h-3.5 mr-1" /> Save as Draft
            </Button>

            <Button type="submit" size="sm" isLoading={isSubmitting}>
              <Send className="w-3.5 h-3.5 mr-1" /> Submit Report for Review
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

