import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ShieldCheck,
  Plus,
  UserCheck,
  UserX,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { userService } from '../../services';
import { User, AdminCount } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

const createAdminSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid work email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
});

type CreateAdminFormValues = z.infer<typeof createAdminSchema>;

export const Admins: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<User[]>([]);
  const [counts, setCounts] = useState<AdminCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
  const [statusAction, setStatusAction] = useState<'ACTIVE' | 'DISABLED' | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAdminFormValues>({
    resolver: zodResolver(createAdminSchema),
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [countRes, adminListRes] = await Promise.all([
        userService.getAdminCount(),
        userService.listAdmins({ pageSize: 50 }),
      ]);
      setCounts(countRes);
      setAdmins(adminListRes.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (data: CreateAdminFormValues) => {
    setIsSubmitting(true);
    try {
      await userService.createAdmin(data);
      toast.success('Admin account created successfully');
      setIsCreateOpen(false);
      reset();
      loadData();
    } catch {
      // Error handled by interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedAdmin || !statusAction) return;
    setIsSubmitting(true);
    try {
      await userService.updateStatus(selectedAdmin.id, statusAction, disableReason);
      toast.success(`Admin account ${statusAction === 'ACTIVE' ? 'reactivated' : 'disabled'}`);
      setSelectedAdmin(null);
      setStatusAction(null);
      setDisableReason('');
      loadData();
    } catch {
      // Error handled by interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading Admin accounts & slot quota..." />;
  }

  const isLimitReached = (counts?.total || 0) >= 5;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Accounts Management"
        description="Manage system administrators. Enforced system limit of maximum 5 Admin accounts."
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            disabled={isLimitReached}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {isLimitReached ? 'Admin Quota Full (5/5)' : 'Create Admin'}
          </Button>
        }
      />

      {/* Admin Slot Quota Card */}
      <Card className="bg-gradient-to-r from-purple-900 to-slate-900 text-white border-0 shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-purple-600/30 rounded-2xl border border-purple-400/30 text-purple-300">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight text-white">Admin Account Limit</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-purple-500/20 text-purple-300 border border-purple-400/30 font-bold">
                  {counts?.total || 0} / 5 Occupied
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-1 max-w-xl leading-relaxed">
                Rules: Maximum 5 Admin accounts in total. Disabled Admins still count toward this quota.
                Accounts cannot delete history; use safe disabling. Admins cannot disable their own accounts.
              </p>
            </div>
          </div>

          <div className="sm:text-right shrink-0">
            <p className="text-xs text-purple-300 font-semibold uppercase tracking-wider">
              Remaining Slots
            </p>
            <p className="text-3xl font-extrabold text-white mt-0.5">{counts?.remaining || 0}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 rounded-full h-2.5 mt-5 overflow-hidden border border-slate-700">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${
              isLimitReached ? 'bg-amber-400' : 'bg-purple-500'
            }`}
            style={{ width: `${((counts?.total || 0) / 5) * 100}%` }}
          />
        </div>
      </Card>

      {/* Admin Accounts Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200/70 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">All Administrator Accounts</h3>
          <span className="text-xs text-slate-500">{admins.length} Total Admins</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-600 border-b border-slate-100 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-5">Administrator</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Department & Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((adm) => {
                const isCurrent = adm.id === currentUser?.id;
                const isActive = adm.status === 'ACTIVE';

                return (
                  <tr key={adm.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
                          {adm.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            {adm.fullName}
                            {isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-semibold">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500">{adm.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">{adm.phone || '-'}</td>

                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{adm.designation || 'Administrator'}</p>
                      <p className="text-[11px] text-slate-500">{adm.department || 'Executive'}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={adm.status} />
                    </td>

                    <td className="py-3.5 px-4 text-slate-500">{formatDate(adm.createdAt)}</td>

                    <td className="py-3.5 px-5 text-right">
                      {isCurrent ? (
                        <span className="text-[11px] text-slate-400 italic">Self (Protected)</span>
                      ) : isActive ? (
                        <button
                          onClick={() => {
                            setSelectedAdmin(adm);
                            setStatusAction('DISABLED');
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors inline-flex items-center gap-1"
                        >
                          <UserX className="w-3.5 h-3.5" /> Disable
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedAdmin(adm);
                            setStatusAction('ACTIVE');
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors inline-flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Admin Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Administrator Account"
        description={`Available Admin slots: ${counts?.remaining} of 5`}
      >
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <Input
            label="Full Name *"
            placeholder="e.g. John Doe"
            error={errors.fullName?.message}
            {...register('fullName')}
          />

          <Input
            label="Work Email Address *"
            type="email"
            placeholder="admin.name@viralstan.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Temporary Password *"
            type="password"
            placeholder="Minimum 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Phone Number" placeholder="+91 98765 43210" {...register('phone')} />
            <Input label="Department" placeholder="Operations / Marketing" {...register('department')} />
          </div>

          <Input label="Designation" placeholder="e.g. Operations Director" {...register('designation')} />

          <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <p className="text-xs text-purple-800 leading-tight">
              Creating this account will consume 1 Admin slot ({counts?.total || 0} of 5). Admins have full access to company dashboards, client accounts, financial reports, and employee oversight.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Create Admin Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Disable / Enable Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(selectedAdmin && statusAction)}
        onClose={() => {
          setSelectedAdmin(null);
          setStatusAction(null);
        }}
        onConfirm={handleToggleStatus}
        title={statusAction === 'DISABLED' ? 'Disable Admin Account' : 'Reactivate Admin Account'}
        message={
          statusAction === 'DISABLED'
            ? `Are you sure you want to disable ${selectedAdmin?.fullName}'s Admin account? They will immediately lose access and active sessions will be terminated. Historical business records and the 5-Admin slot will be preserved.`
            : `Are you sure you want to reactivate ${selectedAdmin?.fullName}'s Admin account? They will be able to log in with full Admin privileges.`
        }
        confirmText={statusAction === 'DISABLED' ? 'Disable Account' : 'Reactivate Account'}
        variant={statusAction === 'DISABLED' ? 'danger' : 'primary'}
        isLoading={isSubmitting}
      />
    </div>
  );
};

