import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, Plus, Search, UserCheck, UserX, Briefcase, CheckSquare } from 'lucide-react';
import { userService } from '../../services';
import { User } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  FilterDrawer,
} from '../../components/filters';

const createEmployeeSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Valid work email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required (e.g. EMP-105)'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  joiningDate: z.string().optional(),
});

type CreateEmployeeFormValues = z.infer<typeof createEmployeeSchema>;

export const Employees: React.FC = () => {
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters, activeFiltersCount } =
    useSmartFilters({
      search: '',
      status: '',
      department: '',
      designation: '',
    });

  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [statusAction, setStatusAction] = useState<'ACTIVE' | 'DISABLED' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      department: 'Creative & Design',
    },
  });

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      const res = await userService.listEmployees({
        search: filters.search || undefined,
        status: filters.status || undefined,
        department: filters.department || undefined,
        designation: filters.designation || undefined,
        pageSize: 100,
      });
      setEmployees(res.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [
    filters.search,
    filters.status,
    filters.department,
    filters.designation,
  ]);

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.status) list.push({ key: 'status', label: 'Status', value: filters.status });
    if (filters.department) list.push({ key: 'department', label: 'Department', value: filters.department });
    if (filters.designation) list.push({ key: 'designation', label: 'Designation', value: filters.designation });
    return list;
  }, [filters]);

  const handleRemoveActiveFilter = (key: string) => {
    clearFilter(key);
  };

  const handleCreate = async (data: CreateEmployeeFormValues) => {
    setIsSubmitting(true);
    try {
      await userService.createEmployee(data);
      toast.success('Employee onboarded successfully');
      setIsCreateOpen(false);
      reset();
      loadEmployees();
    } catch {
      // Handled by interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedEmployee || !statusAction) return;
    setIsSubmitting(true);
    try {
      await userService.updateStatus(selectedEmployee.id, statusAction);
      toast.success(`Employee account ${statusAction === 'ACTIVE' ? 'reactivated' : 'disabled'}`);
      setSelectedEmployee(null);
      setStatusAction(null);
      loadEmployees();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Team Management"
        description="Manage creative designers, video editors, ads specialists, and SEO copywriters."
        actions={
          <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Employee
          </Button>
        }
      />

      {/* Unified Filter Toolbar */}
      <FilterToolbar
        totalResults={employees.length}
        resultsLabel="team members"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
        onOpenAdvanced={() => setIsAdvancedOpen(true)}
        advancedCount={
          [filters.designation].filter(Boolean).length
        }
        advancedLabel="Advanced Filters"
      >
        <SearchInput
          placeholder="Search by name, email, or employee ID..."
          value={filters.search}
          onChange={(val) => setFilter('search', val)}
          className="w-full sm:w-80"
        />

        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(val) => setFilter('status', val)}
          options={[
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Disabled', value: 'DISABLED' },
          ]}
        />

        <FilterSelect
          label="Department"
          value={filters.department}
          onChange={(val) => setFilter('department', val)}
          options={[
            { label: 'Creative & Design', value: 'Creative & Design' },
            { label: 'Video Production', value: 'Video Production' },
            { label: 'Performance Marketing', value: 'Performance Marketing' },
            { label: 'Content & Copywriting', value: 'Content & Copywriting' },
            { label: 'Web Development', value: 'Web Development' },
          ]}
        />
      </FilterToolbar>

      {/* Advanced Filter Drawer */}
      <FilterDrawer
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
        title="Advanced Employee Filters"
        onApply={() => setIsAdvancedOpen(false)}
        onReset={() => {
          clearAllFilters();
          setIsAdvancedOpen(false);
        }}
        activeFiltersCount={activeFiltersCount}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Designation</label>
            <input
              type="text"
              placeholder="e.g. Senior Video Editor, Graphic Designer"
              value={filters.designation}
              onChange={(e) => setFilter('designation', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </FilterDrawer>

      {isLoading ? (
        <LoadingState message="Loading team members..." />
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No employees match your filter criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search query, clearing specific department or status filters.
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
                  <th className="py-3 px-5">Employee</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                          {emp.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{emp.fullName}</p>
                          <p className="text-[11px] text-slate-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                      {emp.employeeId || '-'}
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{emp.designation || '-'}</p>
                      <p className="text-[11px] text-purple-600 font-medium">{emp.department || '-'}</p>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">{emp.phone || '-'}</td>

                    <td className="py-3.5 px-4 text-slate-500">{formatDate(emp.joiningDate || emp.createdAt)}</td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={emp.status} />
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      {emp.status === 'ACTIVE' ? (
                        <button
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setStatusAction('DISABLED');
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors inline-flex items-center gap-1"
                        >
                          <UserX className="w-3.5 h-3.5" /> Disable
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setStatusAction('ACTIVE');
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors inline-flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Employee Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Employee"
        description="Create employee login credentials and profile details"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name *"
              placeholder="e.g. Rahul Verma"
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <Input
              label="Employee ID *"
              placeholder="e.g. EMP-105"
              error={errors.employeeId?.message}
              {...register('employeeId')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Work Email Address *"
              type="email"
              placeholder="employee@viralstan.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Initial Password *"
              type="password"
              placeholder="Minimum 8 characters"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Department *</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                {...register('department')}
              >
                <option value="Creative & Design">Creative & Design</option>
                <option value="Video Production">Video Production</option>
                <option value="Performance Marketing">Performance Marketing</option>
                <option value="Content & Copywriting">Content & Copywriting</option>
                <option value="Web Development">Web Development</option>
              </select>
            </div>

            <Input
              label="Designation *"
              placeholder="e.g. Senior Video Editor"
              error={errors.designation?.message}
              {...register('designation')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Phone Number" placeholder="+91 98112 23344" {...register('phone')} />
            <Input label="Joining Date" type="date" {...register('joiningDate')} />
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
              Add Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Disable / Enable Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(selectedEmployee && statusAction)}
        onClose={() => {
          setSelectedEmployee(null);
          setStatusAction(null);
        }}
        onConfirm={handleToggleStatus}
        title={statusAction === 'DISABLED' ? 'Disable Employee Account' : 'Reactivate Employee Account'}
        message={
          statusAction === 'DISABLED'
            ? `Are you sure you want to disable ${selectedEmployee?.fullName}'s employee account? They will not be able to log in or submit work reports.`
            : `Are you sure you want to reactivate ${selectedEmployee?.fullName}'s employee account?`
        }
        confirmText={statusAction === 'DISABLED' ? 'Disable Account' : 'Reactivate Account'}
        variant={statusAction === 'DISABLED' ? 'danger' : 'primary'}
        isLoading={isSubmitting}
      />
    </div>
  );
};

