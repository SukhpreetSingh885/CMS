import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Ban,
  Layers,
  Briefcase,
  PackageCheck,
  CheckSquare,
} from 'lucide-react';
import { packageService } from '../../services';
import { ServiceItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

export const Services: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Accordion state: set of expanded service IDs
  const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(new Set());

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });

  // Delete dialog state
  const [serviceToDelete, setServiceToDelete] = useState<ServiceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status toggle confirmation
  const [serviceToToggle, setServiceToToggle] = useState<ServiceItem | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const loadServices = async () => {
    setIsLoading(true);
    try {
      const data = await packageService.listServices();
      setServices(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenAdd = () => {
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (svc: ServiceItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingService(svc);
    setFormData({
      name: svc.name,
      description: svc.description || '',
      isActive: svc.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Service name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingService) {
        await packageService.updateService(editingService.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          isActive: formData.isActive,
        });
        toast.success(`Service "${formData.name.trim()}" updated successfully`);
      } else {
        await packageService.createService({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          isActive: formData.isActive,
        });
        toast.success(`Service "${formData.name.trim()}" created successfully`);
      }
      setIsModalOpen(false);
      loadServices();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!serviceToToggle) return;
    setIsToggling(true);
    try {
      const nextStatus = !serviceToToggle.isActive;
      await packageService.updateService(serviceToToggle.id, {
        isActive: nextStatus,
      });
      toast.success(
        `Service "${serviceToToggle.name}" ${nextStatus ? 'reactivated' : 'disabled'} successfully`
      );
      setServiceToToggle(null);
      loadServices();
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
      await packageService.deleteService(serviceToDelete.id);
      toast.success(`Service "${serviceToDelete.name}" deleted successfully`);
      setServiceToDelete(null);
      loadServices();
    } catch {
      // Handled by API error interceptor
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      const matchesSearch =
        svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (svc.description || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && svc.isActive) ||
        (statusFilter === 'DISABLED' && !svc.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [services, searchQuery, statusFilter]);

  if (isLoading) {
    return <LoadingState message="Loading Services Master catalog..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services Master"
        description="Master list of agency digital marketing services, scopes of work, and availability."
        actions={
          <Button onClick={handleOpenAdd} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Service
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:px-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search services by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="DISABLED">Disabled Only</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-900">{filteredServices.length}</span> of{' '}
          <span className="font-bold text-slate-900">{services.length}</span> services
        </div>
      </div>

      {/* Clean Vertical Accordion List */}
      {filteredServices.length === 0 ? (
        <Card className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            {services.length === 0 ? 'No services created yet' : 'No matching services found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {services.length === 0
              ? 'Click "Add Service" to register agency services such as SEO, Web Development, Graphic Designing, Video Editing, UGC Videos, Social Media Management, Google Ads & Meta Ads, or Influencer Marketing.'
              : 'Try clearing your search query or adjusting the status filter.'}
          </p>
          {services.length === 0 && (
            <Button onClick={handleOpenAdd} className="flex items-center gap-1.5 mx-auto">
              <Plus className="w-4 h-4" /> Add First Service
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredServices.map((svc) => {
            const isExpanded = expandedServiceIds.has(svc.id);
            const clientsCount = svc._count?.clientServices || 0;
            const tasksCount = svc._count?.tasks || 0;
            const packagesCount = svc._count?.packageServices || 0;

            return (
              <div
                key={svc.id}
                className={`bg-white rounded-xl border transition-all duration-150 overflow-hidden ${
                  isExpanded
                    ? 'border-purple-300 shadow-sm ring-1 ring-purple-100'
                    : 'border-slate-200/90 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Main Row / Header (Always Visible) */}
                <div
                  onClick={() => toggleExpand(svc.id)}
                  className="p-3.5 sm:px-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Status indicator dot / Icon */}
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0 border ${
                        svc.isActive
                          ? 'bg-purple-50 text-purple-700 border-purple-200/80'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{svc.name}</h4>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            svc.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {svc.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      {svc.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5 max-w-2xl">
                          {svc.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side stats badges & chevron */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                      {clientsCount > 0 && (
                        <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                          {clientsCount} {clientsCount === 1 ? 'client' : 'clients'}
                        </span>
                      )}
                      {packagesCount > 0 && (
                        <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                          {packagesCount} {packagesCount === 1 ? 'package' : 'packages'}
                        </span>
                      )}
                    </div>

                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-purple-600' : ''
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/40 text-xs">
                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Scope & Description
                        </span>
                        <p className="text-xs text-slate-700 leading-relaxed bg-white border border-slate-200/80 rounded-lg p-3 whitespace-pre-line">
                          {svc.description || 'No description provided for this service.'}
                        </p>
                      </div>

                      {/* Usage Metrics */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 flex items-center gap-2.5">
                          <Briefcase className="w-4 h-4 text-purple-600 shrink-0" />
                          <div>
                            <p className="text-[10px] text-slate-400 font-medium">Client Contracts</p>
                            <p className="font-bold text-slate-900">{clientsCount} Assigned</p>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 flex items-center gap-2.5">
                          <PackageCheck className="w-4 h-4 text-purple-600 shrink-0" />
                          <div>
                            <p className="text-[10px] text-slate-400 font-medium">Package Bundles</p>
                            <p className="font-bold text-slate-900">{packagesCount} Bundled</p>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 flex items-center gap-2.5">
                          <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                          <div>
                            <p className="text-[10px] text-slate-400 font-medium">Deliverable Tasks</p>
                            <p className="font-bold text-slate-900">{tasksCount} Created</p>
                          </div>
                        </div>
                      </div>

                      {/* Admin Actions Toolbar */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">
                          Master Catalog ID: <span className="font-mono text-slate-600">{svc.id}</span>
                        </span>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleOpenEdit(svc, e)}
                            className="flex items-center gap-1.5 text-xs h-8 text-slate-700 hover:text-purple-700 hover:bg-purple-50"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit Service
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setServiceToToggle(svc)}
                            className={`flex items-center gap-1.5 text-xs h-8 ${
                              svc.isActive
                                ? 'text-amber-700 border-amber-300 hover:bg-amber-50'
                                : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                            }`}
                          >
                            {svc.isActive ? (
                              <>
                                <Ban className="w-3.5 h-3.5" /> Disable
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Reactivate
                              </>
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setServiceToDelete(svc)}
                            className="flex items-center gap-1.5 text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Service Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingService ? 'Edit Service' : 'Add Service'}
        description={
          editingService
            ? 'Update service catalog details and availability status'
            : 'Register a new agency deliverable service in MySQL'
        }
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Service Name *"
            placeholder="e.g. SEO, Video Editing, Influencer Marketing"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Textarea
            label="Description"
            placeholder="Detailed scope of work, deliverable standards, and overview..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
          />

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Status *</label>
            <select
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              value={formData.isActive ? 'ACTIVE' : 'DISABLED'}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'ACTIVE' })}
            >
              <option value="ACTIVE">Active (Available for Packages & Clients)</option>
              <option value="DISABLED">Disabled (Unavailable for new Packages)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              {editingService ? 'Save Changes' : 'Create Service'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Disable / Reactivate Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(serviceToToggle)}
        onClose={() => setServiceToToggle(null)}
        onConfirm={handleConfirmToggleStatus}
        title={serviceToToggle?.isActive ? 'Disable Service' : 'Reactivate Service'}
        message={
          serviceToToggle?.isActive
            ? `Are you sure you want to disable "${serviceToToggle?.name}"? It will not be selectable for new packages, but existing client contracts and tasks remain unaffected.`
            : `Are you sure you want to reactivate "${serviceToToggle?.name}"? It will become available for new service packages and client contracts.`
        }
        confirmText={serviceToToggle?.isActive ? 'Disable Service' : 'Reactivate Service'}
        variant={serviceToToggle?.isActive ? 'danger' : 'primary'}
        isLoading={isToggling}
      />

      {/* Delete Service Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(serviceToDelete)}
        onClose={() => setServiceToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Service"
        message={`Are you sure you want to permanently delete "${serviceToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Service"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
