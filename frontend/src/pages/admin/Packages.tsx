import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Check,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Eye,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  X,
  FileText,
  Briefcase,
  ListPlus,
  HelpCircle,
} from 'lucide-react';
import { packageService } from '../../services';
import { Package, PackageType, ServiceItem, PackageDeliverable } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { LoadingState } from '../../components/common/LoadingState';
import { formatINR } from '../../utils/formatters';
import { toast } from 'sonner';

interface DeliverableFormItem {
  id?: string;
  name: string;
  deliverableType: 'QUANTITY' | 'FEATURE' | 'MILESTONE';
  quantity?: number;
  unit?: string;
  targetPeriod: 'ONE_TIME' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CAMPAIGN_SCOPE' | 'MILESTONE_BASED';
  isIncluded: boolean;
  description?: string;
}

interface ServiceFormItem {
  serviceId: string;
  serviceName: string;
  included: boolean;
  monthlyTarget?: number;
  defaultWeight?: number;
  deliverables?: string;
  deliverablesList: DeliverableFormItem[];
}

interface PackageFormData {
  name: string;
  packageType: PackageType;
  description: string;
  basePrice: number | string;
  setupFee: number | string;
  billingCycle: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ANNUALLY';
  features: string[];
  newFeatureInput: string;
  services: ServiceFormItem[];
}

export const Packages: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SINGLE_SERVICE' | 'COMBINED_BUSINESS'>('ALL');
  const [viewArchived, setViewArchived] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);

  // View Details Modal
  const [detailsPackage, setDetailsPackage] = useState<Package | null>(null);

  // Archive / Delete confirmation dialogs
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [packageToArchive, setPackageToArchive] = useState<Package | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Field-level form errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form State
  const [formData, setFormData] = useState<PackageFormData>({
    name: '',
    packageType: 'SINGLE_SERVICE',
    description: '',
    basePrice: 50000,
    setupFee: 0,
    billingCycle: 'MONTHLY',
    features: [],
    newFeatureInput: '',
    services: [],
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pkgs, svcs] = await Promise.all([
        packageService.listPackages(),
        packageService.listServices(),
      ]);
      setPackages(pkgs || []);
      setServices(svcs || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getBillingCycleLabel = (cycle: string) => {
    switch (cycle) {
      case 'ONE_TIME':
        return 'One-Time Project';
      case 'MONTHLY':
        return 'Monthly';
      case 'QUARTERLY':
        return 'Quarterly';
      case 'YEARLY':
      case 'ANNUALLY':
        return 'Yearly';
      default:
        return cycle;
    }
  };

  const getPriceSuffix = (cycle: string) => {
    switch (cycle) {
      case 'ONE_TIME':
        return ' / project';
      case 'MONTHLY':
        return ' / month';
      case 'QUARTERLY':
        return ' / quarter';
      case 'YEARLY':
      case 'ANNUALLY':
        return ' / year';
      default:
        return '';
    }
  };

  // Open Create Modal
  const handleOpenCreate = (prefillType: PackageType = 'SINGLE_SERVICE') => {
    setEditingPackage(null);
    setFormErrors({});

    const initialServices: ServiceFormItem[] = services.map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      included: false,
      monthlyTarget: 10,
      defaultWeight: 1.0,
      deliverables: '',
      deliverablesList: [
        {
          name: `${s.name} Deliverables`,
          deliverableType: 'QUANTITY',
          quantity: 10,
          unit: 'Units',
          targetPeriod: 'MONTHLY',
          isIncluded: true,
        },
      ],
    }));

    setFormData({
      name: '',
      packageType: prefillType,
      description: '',
      basePrice: 50000,
      setupFee: 0,
      billingCycle: 'MONTHLY',
      features: ['Dedicated Account Manager', 'Weekly Performance Reports'],
      newFeatureInput: '',
      services: initialServices,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (pkg: Package) => {
    setEditingPackage(pkg);
    setFormErrors({});

    const existingMap = new Map(
      pkg.packageServices?.map((ps) => [
        ps.serviceId,
        {
          target: ps.monthlyTarget ?? 10,
          deliverables: ps.deliverables || '',
          deliverablesList:
            ps.deliverablesList && ps.deliverablesList.length > 0
              ? ps.deliverablesList.map((d) => ({
                  id: d.id,
                  name: d.name,
                  deliverableType: d.deliverableType || 'QUANTITY',
                  quantity: d.quantity ?? 1,
                  unit: d.unit || 'Units',
                  targetPeriod: d.targetPeriod || (pkg.billingCycle === 'ONE_TIME' ? 'ONE_TIME' : 'MONTHLY'),
                  isIncluded: d.isIncluded !== false,
                  description: d.description || '',
                }))
              : [
                  {
                    name: `${ps.service.name} Deliverables`,
                    deliverableType: 'QUANTITY' as const,
                    quantity: ps.monthlyTarget ?? 10,
                    unit: 'Units',
                    targetPeriod: (pkg.billingCycle === 'ONE_TIME' ? 'ONE_TIME' : 'MONTHLY') as any,
                    isIncluded: true,
                  },
                ],
        },
      ]) || []
    );

    const mappedServices: ServiceFormItem[] = services.map((s) => {
      const existing = existingMap.get(s.id);
      const isIncluded = existingMap.has(s.id);
      return {
        serviceId: s.id,
        serviceName: s.name,
        included: isIncluded,
        monthlyTarget: existing?.target ?? 10,
        defaultWeight: 1.0,
        deliverables: existing?.deliverables ?? '',
        deliverablesList: existing?.deliverablesList || [
          {
            name: `${s.name} Deliverables`,
            deliverableType: 'QUANTITY',
            quantity: 10,
            unit: 'Units',
            targetPeriod: (pkg.billingCycle === 'ONE_TIME' ? 'ONE_TIME' : 'MONTHLY'),
            isIncluded: true,
          },
        ],
      };
    });

    setFormData({
      name: pkg.name,
      packageType: pkg.packageType || (pkg.packageServices && pkg.packageServices.length >= 2 ? 'COMBINED_BUSINESS' : 'SINGLE_SERVICE'),
      description: pkg.description || '',
      basePrice: Number(pkg.basePrice),
      setupFee: Number(pkg.setupFee || 0),
      billingCycle: pkg.billingCycle || 'MONTHLY',
      features: Array.isArray(pkg.features) ? (pkg.features as string[]) : [],
      newFeatureInput: '',
      services: mappedServices,
    });
    setIsModalOpen(true);
  };

  // Add / Remove Deliverable row for a service
  const handleAddDeliverable = (serviceIndex: number) => {
    const updated = [...formData.services];
    updated[serviceIndex].deliverablesList.push({
      name: '',
      deliverableType: 'QUANTITY',
      quantity: 1,
      unit: 'Units',
      targetPeriod: formData.billingCycle === 'ONE_TIME' ? 'ONE_TIME' : 'MONTHLY',
      isIncluded: true,
    });
    setFormData({ ...formData, services: updated });
  };

  const handleRemoveDeliverable = (serviceIndex: number, deliverableIndex: number) => {
    const updated = [...formData.services];
    if (updated[serviceIndex].deliverablesList.length <= 1) {
      toast.error('Each included service must have at least one deliverable');
      return;
    }
    updated[serviceIndex].deliverablesList.splice(deliverableIndex, 1);
    setFormData({ ...formData, services: updated });
  };

  // Add / Remove Feature bullets
  const handleAddFeature = () => {
    const trimmed = formData.newFeatureInput.trim();
    if (!trimmed) return;
    if (formData.features.includes(trimmed)) {
      toast.error('Feature already added');
      return;
    }
    setFormData({
      ...formData,
      features: [...formData.features, trimmed],
      newFeatureInput: '',
    });
  };

  const handleRemoveFeature = (idx: number) => {
    const updated = [...formData.features];
    updated.splice(idx, 1);
    setFormData({ ...formData, features: updated });
  };

  // Validate form before submission
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Package name is required';
    }

    const price = Number(formData.basePrice);
    if (isNaN(price) || price < 0) {
      errors.basePrice = 'Price must be 0 or a positive number';
    }

    const setupFee = Number(formData.setupFee || 0);
    if (isNaN(setupFee) || setupFee < 0) {
      errors.setupFee = 'Setup fee must be 0 or a positive number';
    }

    const includedServices = formData.services.filter((s) => s.included);

    if (formData.packageType === 'SINGLE_SERVICE') {
      if (includedServices.length === 0) {
        errors.services = 'Single Service Package requires selecting exactly one service';
      } else if (includedServices.length > 1) {
        errors.services = `Single Service Package must contain exactly 1 service (currently selected: ${includedServices.length}). Switch to "Business / Combined Package" for multiple services.`;
      }
    } else {
      if (includedServices.length < 2) {
        errors.services = `Business / Combined Package must contain at least 2 services (currently selected: ${includedServices.length}).`;
      }
    }

    // Validate deliverables within included services
    for (const svc of includedServices) {
      for (const d of svc.deliverablesList) {
        if (!d.name.trim()) {
          errors.services = `Deliverable name is required for ${svc.serviceName}`;
          break;
        }
        if (d.deliverableType === 'QUANTITY') {
          if (!d.quantity || d.quantity <= 0) {
            errors.services = `Deliverable quantity must be at least 1 for ${svc.serviceName}`;
            break;
          }
          if (!d.unit || !d.unit.trim()) {
            errors.services = `Deliverable unit is required for ${svc.serviceName}`;
            break;
          }
        }
      }
      if (errors.services) break;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      const includedServices = formData.services
        .filter((s) => s.included)
        .map((s) => {
          const deliverablesSummary = s.deliverablesList
            .map((d) => {
              if (d.deliverableType === 'FEATURE') {
                return `${d.name}: ${d.isIncluded !== false ? 'Included' : 'Excluded'}`;
              }
              return `${d.name}: ${d.quantity ?? 1} ${d.unit || ''}`.trim();
            })
            .join(', ');

          const totalQuantity = s.deliverablesList
            .filter((d) => d.deliverableType !== 'FEATURE')
            .reduce((acc, curr) => acc + Number(curr.quantity || 1), 0);

          return {
            serviceId: s.serviceId,
            monthlyTarget: totalQuantity > 0 ? totalQuantity : 10,
            defaultWeight: Number(s.defaultWeight || 1.0),
            deliverables: deliverablesSummary,
            deliverablesList: s.deliverablesList.map((d, i) => ({
              id: d.id,
              name: d.name.trim(),
              deliverableType: d.deliverableType,
              quantity: d.deliverableType === 'FEATURE' ? null : Number(d.quantity || 1),
              unit: d.deliverableType === 'FEATURE' ? null : (d.unit || 'Units').trim(),
              targetPeriod: d.targetPeriod || (formData.billingCycle === 'ONE_TIME' ? 'ONE_TIME' : 'MONTHLY'),
              isIncluded: d.isIncluded !== false,
              description: d.description?.trim() || null,
              sortOrder: i,
            })),
          };
        });

      const payload = {
        name: formData.name.trim(),
        packageType: formData.packageType,
        description: formData.description.trim() || null,
        basePrice: Number(formData.basePrice),
        setupFee: Number(formData.setupFee || 0),
        billingCycle: formData.billingCycle,
        features: formData.features,
        services: includedServices,
      };

      if (editingPackage) {
        await packageService.updatePackage(editingPackage.id, payload);
        toast.success(`Package "${formData.name}" updated successfully`);
      } else {
        await packageService.createPackage(payload);
        toast.success(`Package "${formData.name}" created successfully`);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      // Backend validation handled by interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Archive
  const handleToggleArchive = async () => {
    if (!packageToArchive) return;
    setIsArchiving(true);
    try {
      const nextArchived = !packageToArchive.isArchived;
      await packageService.archivePackage(packageToArchive.id, nextArchived);
      toast.success(
        `Package "${packageToArchive.name}" ${nextArchived ? 'archived' : 'restored'} successfully`
      );
      setPackageToArchive(null);
      loadData();
    } finally {
      setIsArchiving(false);
    }
  };

  // Delete
  const handleDeleteConfirm = async () => {
    if (!packageToDelete) return;
    setIsDeleting(true);
    try {
      await packageService.deletePackage(packageToDelete.id);
      toast.success(`Package "${packageToDelete.name}" deleted successfully`);
      setPackageToDelete(null);
      loadData();
    } catch {
      // Handled by API interceptor
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      // Archive filter
      if (viewArchived ? !pkg.isArchived : pkg.isArchived) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'ALL' && pkg.packageType !== typeFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = pkg.name.toLowerCase().includes(query);
        const matchesDesc = (pkg.description || '').toLowerCase().includes(query);
        const matchesService = pkg.packageServices?.some((ps) =>
          ps.service.name.toLowerCase().includes(query)
        );
        return matchesName || matchesDesc || matchesService;
      }

      return true;
    });
  }, [packages, searchQuery, typeFilter, viewArchived]);

  if (isLoading) {
    return <LoadingState message="Loading package offerings & deliverables..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universal Package Management"
        description="Configure standardized single-service packages and multi-service business packages with customizable deliverables and pricing."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenCreate('SINGLE_SERVICE')}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-4 h-4 text-purple-600" /> Single Service Pack
            </Button>
            <Button
              onClick={() => handleOpenCreate('COMBINED_BUSINESS')}
              className="flex items-center gap-1.5 text-xs bg-purple-700 hover:bg-purple-800 text-white"
            >
              <Sparkles className="w-4 h-4" /> New Combined Package
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:px-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search packages by name, service or deliverables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                typeFilter === 'ALL'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('SINGLE_SERVICE')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                typeFilter === 'SINGLE_SERVICE'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Single Service
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('COMBINED_BUSINESS')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                typeFilter === 'COMBINED_BUSINESS'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Combined Business
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewArchived(!viewArchived)}
            className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
              viewArchived
                ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            {viewArchived ? 'Showing Archived' : 'View Archived'}
          </button>

          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Showing <strong className="text-slate-900">{filteredPackages.length}</strong> package(s)
          </span>
        </div>
      </div>

      {/* Package Pricing Cards Grid */}
      {filteredPackages.length === 0 ? (
        <Card className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            {viewArchived
              ? 'No archived packages found'
              : packages.length === 0
              ? 'No service packages created yet'
              : 'No packages match your search filter'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {packages.length === 0
              ? 'Create single-service packages (e.g. Website Development Basic, Video Editing Premium) or combined business packages bundling multiple agency services.'
              : 'Try clearing your search query or adjusting the package type filter.'}
          </p>
          {packages.length === 0 && (
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => handleOpenCreate('SINGLE_SERVICE')} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Create Single Service Pack
              </Button>
              <Button onClick={() => handleOpenCreate('COMBINED_BUSINESS')} size="sm" variant="outline">
                <Sparkles className="w-4 h-4 mr-1" /> Create Combined Package
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => {
            const isOneTime = pkg.billingCycle === 'ONE_TIME';
            const isCombined = pkg.packageType === 'COMBINED_BUSINESS';
            const servicesCount = pkg.packageServices?.length || 0;
            const features = Array.isArray(pkg.features) ? (pkg.features as string[]) : [];

            return (
              <div
                key={pkg.id}
                className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between hover:shadow-lg ${
                  pkg.isArchived
                    ? 'border-slate-200 bg-slate-50/70 opacity-80'
                    : isCombined
                    ? 'border-purple-200 hover:border-purple-400 ring-1 ring-purple-100/50'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="p-6">
                  {/* Card Header & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                          isCombined
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {isCombined ? 'Combined Business Pack' : 'Single Service Pack'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                          isOneTime
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {getBillingCycleLabel(pkg.billingCycle)}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-500 font-medium shrink-0">
                      {pkg._count?.clients || 0} active client(s)
                    </span>
                  </div>

                  {/* Package Title & Description */}
                  <h3 className="text-xl font-extrabold text-slate-900 mt-3">{pkg.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[32px] leading-relaxed">
                    {pkg.description ||
                      (isCombined
                        ? 'All-inclusive multi-service business growth bundle.'
                        : 'Focused single-channel deliverable package.')}
                  </p>

                  {/* Pricing Display */}
                  <div className="mt-4 pb-4 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-slate-900">
                        {formatINR(pkg.basePrice)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {getPriceSuffix(pkg.billingCycle)}
                      </span>
                    </div>
                    {pkg.setupFee && Number(pkg.setupFee) > 0 ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          + {formatINR(pkg.setupFee)} Setup Fee
                        </span>
                      </div>
                    ) : null}
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium block mt-1">
                      {isOneTime ? 'Fixed Project Price' : 'Agreed Retainer Billing'}
                    </span>
                  </div>

                  {/* Included Services & Deliverables */}
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wider">
                      <span>Included Services ({servicesCount})</span>
                      <span className="text-[10px] text-slate-400 font-normal lowercase">
                        {isOneTime ? 'project targets' : 'monthly deliverables'}
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {pkg.packageServices?.map((ps) => {
                        const hasDeliverablesList =
                          ps.deliverablesList && ps.deliverablesList.length > 0;

                        return (
                          <div
                            key={ps.id}
                            className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70 text-xs"
                          >
                            <div className="flex items-center justify-between font-semibold text-slate-900">
                              <span className="flex items-center gap-1.5 truncate">
                                <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                {ps.service.name}
                              </span>
                              {ps.monthlyTarget ? (
                                <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-800 shrink-0">
                                  {ps.monthlyTarget} {isOneTime ? 'target' : '/mo'}
                                </span>
                              ) : null}
                            </div>

                            {/* Specific Deliverables List */}
                            {hasDeliverablesList ? (
                              <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-purple-200">
                                {ps.deliverablesList?.map((del, dIdx) => (
                                  <div
                                    key={del.id || dIdx}
                                    className="flex items-center justify-between text-[11px] text-slate-600 gap-1.5"
                                  >
                                    <span className="truncate flex items-center gap-1 min-w-0">
                                      {del.deliverableType === 'FEATURE' ? (
                                        del.isIncluded !== false ? (
                                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                        ) : (
                                          <X className="w-3 h-3 text-rose-500 shrink-0" />
                                        )
                                      ) : del.deliverableType === 'MILESTONE' ? (
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                      ) : (
                                        <span>•</span>
                                      )}
                                      <span className={`truncate ${del.deliverableType === 'FEATURE' && del.isIncluded === false ? 'line-through text-slate-400' : ''}`}>
                                        {del.name}
                                      </span>
                                    </span>
                                    <span className="font-medium text-slate-800 shrink-0 text-[10px]">
                                      {del.deliverableType === 'FEATURE' ? (
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${del.isIncluded !== false ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                                          {del.isIncluded !== false ? 'Included' : 'Excluded'}
                                        </span>
                                      ) : del.deliverableType === 'MILESTONE' ? (
                                        <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-mono text-[9px]">
                                          Milestone
                                        </span>
                                      ) : (
                                        `${del.quantity} ${del.unit}${del.targetPeriod && del.targetPeriod !== 'MONTHLY' ? ` (${del.targetPeriod.toLowerCase().replace('_', ' ')})` : ''}`
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : ps.deliverables ? (
                              <p className="mt-1.5 text-[11px] text-slate-500 pl-5 italic leading-tight">
                                {ps.deliverables}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Included Features Bullet Points */}
                  {features.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Included Features
                      </p>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {features.slice(0, 4).map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{feat}</span>
                          </li>
                        ))}
                        {features.length > 4 && (
                          <li className="text-[11px] text-purple-600 pl-5 font-medium">
                            + {features.length - 4} more features
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Card Action Bar */}
                <div className="p-4 bg-slate-50/80 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailsPackage(pkg)}
                    className="text-xs h-8 text-slate-700 hover:text-purple-700"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> View Details
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(pkg)}
                      className="text-xs h-8 text-slate-700 hover:text-purple-700 hover:bg-purple-50"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPackageToArchive(pkg)}
                      className="text-xs h-8 text-slate-600 hover:text-amber-700 hover:bg-amber-50 border-slate-200"
                      title={pkg.isArchived ? 'Restore Package' : 'Archive Package'}
                    >
                      {pkg.isArchived ? (
                        <RotateCcw className="w-3.5 h-3.5" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPackageToDelete(pkg)}
                      className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                      title="Delete Package"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PACKAGE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPackage ? 'Edit Service Package' : 'Create Universal Package'}
        description="Configure standardized single-service or multi-service business packages with customizable deliverables and pricing."
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Package Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Package Type *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  formData.packageType === 'SINGLE_SERVICE'
                    ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-100'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="packageType"
                  value="SINGLE_SERVICE"
                  checked={formData.packageType === 'SINGLE_SERVICE'}
                  onChange={() => setFormData({ ...formData, packageType: 'SINGLE_SERVICE' })}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Single Service Package</span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Dedicated offering containing exactly one service (e.g. Website Only, SEO Only, Video Editing Only).
                  </span>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  formData.packageType === 'COMBINED_BUSINESS'
                    ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-100'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="packageType"
                  value="COMBINED_BUSINESS"
                  checked={formData.packageType === 'COMBINED_BUSINESS'}
                  onChange={() => setFormData({ ...formData, packageType: 'COMBINED_BUSINESS' })}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Business / Combined Package</span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Bundled growth package combining two or more services with multi-deliverable quotas.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Quick Tier Preset Helper */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Package Name *
              </label>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>Quick Name Tiers:</span>
                {['Basic', 'Standard', 'Premium'].map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      if (!formData.name.includes(tier)) {
                        setFormData({
                          ...formData,
                          name: formData.name ? `${formData.name} - ${tier}` : `${tier} Package`,
                        });
                      }
                    }}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 rounded border border-slate-200 font-medium transition-colors"
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <Input
              placeholder="e.g. Website Development - Standard or 360° Growth Business Package"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
              }}
              error={formErrors.name}
              required
            />
          </div>

          {/* Pricing, Setup Fee and Billing Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={
                formData.billingCycle === 'ONE_TIME'
                  ? 'Total Project Price (₹ INR) *'
                  : 'Agreed Base Price (₹ INR) *'
              }
              type="number"
              placeholder="50000"
              value={formData.basePrice}
              onChange={(e) => {
                setFormData({ ...formData, basePrice: e.target.value });
                if (formErrors.basePrice) setFormErrors({ ...formErrors, basePrice: '' });
              }}
              error={formErrors.basePrice}
              required
            />

            <Input
              label="Setup Fee (₹ INR, Optional)"
              type="number"
              placeholder="0"
              value={formData.setupFee}
              onChange={(e) => {
                setFormData({ ...formData, setupFee: e.target.value });
                if (formErrors.setupFee) setFormErrors({ ...formErrors, setupFee: '' });
              }}
              error={formErrors.setupFee}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Billing Type *
              </label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                value={formData.billingCycle}
                onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as any })}
              >
                <option value="ONE_TIME">One-Time (Whole Project)</option>
                <option value="MONTHLY">Monthly (Recurring Retainer)</option>
                <option value="QUARTERLY">Quarterly (Recurring Retainer)</option>
                <option value="YEARLY">Yearly (Recurring Retainer)</option>
              </select>
            </div>
          </div>

          <Textarea
            label="Package Description"
            placeholder="Overview of scope, deliverables, and intended client goals..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />

          {/* Service Inclusions & Multi-Deliverables Editor */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-800">
                  Configure Included Services & Deliverables *
                </label>
                <span className="text-[11px] text-slate-500">
                  {formData.packageType === 'SINGLE_SERVICE'
                    ? 'Select exactly 1 service for this Single Service package.'
                    : 'Select 2 or more services for this Combined Business package.'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                {formData.services.filter((s) => s.included).length} service(s) selected
              </span>
            </div>

            {formErrors.services && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-2">
                <X className="w-4 h-4 shrink-0 text-rose-500" />
                {formErrors.services}
              </div>
            )}

            {formData.services.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500">No services available in Services Master.</p>
                <p className="text-[11px] text-slate-400 mt-1">Create services first in the Services Master catalog.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-3 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                {formData.services.map((svc, svcIdx) => (
                  <div
                    key={svc.serviceId}
                    className={`rounded-xl border transition-all ${
                      svc.included
                        ? 'bg-white border-purple-300 shadow-xs ring-1 ring-purple-100'
                        : 'bg-white/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Service Header Row */}
                    <div className="p-3 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={svc.included}
                          onChange={(e) => {
                            const updated = [...formData.services];
                            // If Single Service package and user is checking this, uncheck other services
                            if (formData.packageType === 'SINGLE_SERVICE' && e.target.checked) {
                              updated.forEach((s, idx) => {
                                s.included = idx === svcIdx;
                              });
                            } else {
                              updated[svcIdx].included = e.target.checked;
                            }
                            setFormData({ ...formData, services: updated });
                            if (formErrors.services) setFormErrors({ ...formErrors, services: '' });
                          }}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {svc.serviceName}
                        </span>
                      </label>

                      {svc.included && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddDeliverable(svcIdx)}
                          className="text-[11px] h-7 text-purple-700 hover:bg-purple-50 flex items-center gap-1 font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Deliverable
                        </Button>
                      )}
                    </div>

                    {/* Deliverables Builder for Included Service */}
                    {svc.included && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-purple-50/20 rounded-b-xl space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Service Deliverables:
                        </span>

                        <div className="space-y-2">
                          {svc.deliverablesList.map((del, dIdx) => (
                            <div
                              key={dIdx}
                              className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-xs"
                            >
                              {/* Deliverable Type Select */}
                              <div className="w-full sm:w-28 shrink-0">
                                <select
                                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white font-medium text-slate-700"
                                  value={del.deliverableType || 'QUANTITY'}
                                  onChange={(e) => {
                                    const updated = [...formData.services];
                                    const newType = e.target.value as 'QUANTITY' | 'FEATURE' | 'MILESTONE';
                                    updated[svcIdx].deliverablesList[dIdx].deliverableType = newType;
                                    if (newType === 'MILESTONE') {
                                      updated[svcIdx].deliverablesList[dIdx].targetPeriod = 'MILESTONE_BASED';
                                    }
                                    setFormData({ ...formData, services: updated });
                                  }}
                                >
                                  <option value="QUANTITY">Quantity</option>
                                  <option value="FEATURE">Feature</option>
                                  <option value="MILESTONE">Milestone</option>
                                </select>
                              </div>

                              {/* Deliverable Name */}
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  placeholder={
                                    del.deliverableType === 'FEATURE'
                                      ? 'Feature Name (e.g. Dedicated Editor, 24/7 SLA)'
                                      : del.deliverableType === 'MILESTONE'
                                      ? 'Milestone (e.g. UI/UX Prototype, MVP Deploy)'
                                      : 'Deliverable (e.g. Website Pages, Reels, Creatives)'
                                  }
                                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-purple-500"
                                  value={del.name}
                                  onChange={(e) => {
                                    const updated = [...formData.services];
                                    updated[svcIdx].deliverablesList[dIdx].name = e.target.value;
                                    setFormData({ ...formData, services: updated });
                                  }}
                                  required
                                />
                              </div>

                              {/* Quantity & Unit (if QUANTITY) */}
                              {del.deliverableType === 'QUANTITY' && (
                                <>
                                  <div className="w-16 shrink-0">
                                    <input
                                      type="number"
                                      min="1"
                                      placeholder="Qty"
                                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-purple-500 font-mono text-center"
                                      value={del.quantity ?? 1}
                                      onChange={(e) => {
                                        const updated = [...formData.services];
                                        updated[svcIdx].deliverablesList[dIdx].quantity = Number(e.target.value);
                                        setFormData({ ...formData, services: updated });
                                      }}
                                      required
                                    />
                                  </div>

                                  <div className="w-20 shrink-0">
                                    <input
                                      type="text"
                                      placeholder="Unit"
                                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-purple-500"
                                      value={del.unit ?? ''}
                                      onChange={(e) => {
                                        const updated = [...formData.services];
                                        updated[svcIdx].deliverablesList[dIdx].unit = e.target.value;
                                        setFormData({ ...formData, services: updated });
                                      }}
                                      required
                                    />
                                  </div>
                                </>
                              )}

                              {/* Feature Included/Excluded Switch (if FEATURE) */}
                              {del.deliverableType === 'FEATURE' && (
                                <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 bg-slate-50 border rounded text-[11px]">
                                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                                    <input
                                      type="checkbox"
                                      checked={del.isIncluded !== false}
                                      onChange={(e) => {
                                        const updated = [...formData.services];
                                        updated[svcIdx].deliverablesList[dIdx].isIncluded = e.target.checked;
                                        setFormData({ ...formData, services: updated });
                                      }}
                                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span>{del.isIncluded !== false ? 'Included' : 'Excluded'}</span>
                                  </label>
                                </div>
                              )}

                              {/* Target Period Select */}
                              <div className="w-full sm:w-28 shrink-0">
                                <select
                                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-700"
                                  value={del.targetPeriod || 'MONTHLY'}
                                  onChange={(e) => {
                                    const updated = [...formData.services];
                                    updated[svcIdx].deliverablesList[dIdx].targetPeriod = e.target.value as any;
                                    setFormData({ ...formData, services: updated });
                                  }}
                                >
                                  {del.deliverableType === 'MILESTONE' ? (
                                    <>
                                      <option value="MILESTONE_BASED">Milestone-Based</option>
                                      <option value="ONE_TIME">One-Time</option>
                                      <option value="CAMPAIGN_SCOPE">Campaign Scope</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="ONE_TIME">One-Time</option>
                                      <option value="WEEKLY">Weekly</option>
                                      <option value="MONTHLY">Monthly</option>
                                      <option value="QUARTERLY">Quarterly</option>
                                      <option value="YEARLY">Yearly</option>
                                      <option value="CAMPAIGN_SCOPE">Campaign Scope</option>
                                    </>
                                  )}
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveDeliverable(svcIdx, dIdx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors shrink-0"
                                title="Remove deliverable"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Included Features Bullet Points */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-800">
              Package Features & Inclusions (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Dedicated Account Manager, Weekly Strategy Sync, 24/7 SLA"
                value={formData.newFeatureInput}
                onChange={(e) => setFormData({ ...formData, newFeatureInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFeature();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-purple-500"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddFeature}>
                Add Feature
              </Button>
            </div>

            {formData.features.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {formData.features.map((feat, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-medium"
                  >
                    <Check className="w-3 h-3 text-purple-600" />
                    {feat}
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(idx)}
                      className="text-purple-400 hover:text-purple-800 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              {editingPackage ? 'Update Package' : 'Create Package'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* VIEW PACKAGE DETAILS MODAL */}
      <Modal
        isOpen={Boolean(detailsPackage)}
        onClose={() => setDetailsPackage(null)}
        title={detailsPackage?.name || 'Package Details'}
        description={`${getBillingCycleLabel(detailsPackage?.billingCycle || 'MONTHLY')} • ${
          detailsPackage?.packageType === 'COMBINED_BUSINESS'
            ? 'Business / Combined Package'
            : 'Single Service Package'
        }`}
        maxWidth="lg"
      >
        {detailsPackage && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-purple-600 font-bold uppercase tracking-wider block">
                  Agreed Package Price
                </span>
                <span className="text-2xl font-black text-slate-900">
                  {formatINR(detailsPackage.basePrice)}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {getPriceSuffix(detailsPackage.billingCycle)}
                </span>
                {detailsPackage.setupFee && Number(detailsPackage.setupFee) > 0 ? (
                  <div className="mt-1">
                    <span className="text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                      + {formatINR(detailsPackage.setupFee)} Setup Fee
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Active Client Contracts</span>
                <span className="text-lg font-bold text-slate-900">
                  {detailsPackage._count?.clients || 0} Clients
                </span>
              </div>
            </div>

            {detailsPackage.description && (
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Scope & Overview:
                </span>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {detailsPackage.description}
                </p>
              </div>
            )}

            <div>
              <span className="text-xs font-semibold text-slate-800 block mb-2">
                Included Services & Quantified Deliverables:
              </span>
              <div className="space-y-2">
                {detailsPackage.packageServices?.map((ps) => (
                  <div key={ps.id} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-purple-600" />
                        {ps.service.name}
                      </span>
                      {ps.monthlyTarget ? (
                        <span className="font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-700">
                          {ps.monthlyTarget} {detailsPackage.billingCycle === 'ONE_TIME' ? 'total' : '/mo'}
                        </span>
                      ) : null}
                    </div>

                    {ps.deliverablesList && ps.deliverablesList.length > 0 ? (
                      <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-purple-200">
                        {ps.deliverablesList.map((del, dIdx) => (
                          <div key={dIdx} className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className="flex items-center gap-1.5">
                              {del.deliverableType === 'FEATURE' ? (
                                del.isIncluded !== false ? (
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                ) : (
                                  <X className="w-3 h-3 text-rose-500 shrink-0" />
                                )
                              ) : del.deliverableType === 'MILESTONE' ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                              ) : (
                                <span>•</span>
                              )}
                              <span className={del.deliverableType === 'FEATURE' && del.isIncluded === false ? 'line-through text-slate-400' : ''}>
                                {del.name}
                              </span>
                            </span>
                            <span className="font-semibold text-slate-800 shrink-0 text-[10px]">
                              {del.deliverableType === 'FEATURE' ? (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${del.isIncluded !== false ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                                  {del.isIncluded !== false ? 'Included' : 'Excluded'}
                                </span>
                              ) : del.deliverableType === 'MILESTONE' ? (
                                <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-mono text-[9px]">
                                  Milestone ({del.targetPeriod?.toLowerCase().replace('_', ' ') || 'milestone-based'})
                                </span>
                              ) : (
                                `${del.quantity} ${del.unit} (${del.targetPeriod?.toLowerCase().replace('_', ' ') || 'monthly'})`
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : ps.deliverables ? (
                      <p className="mt-1 text-[11px] text-slate-500 pl-4">{ps.deliverables}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {Array.isArray(detailsPackage.features) && (detailsPackage.features as string[]).length > 0 && (
              <div>
                <span className="text-xs font-semibold text-slate-800 block mb-2">
                  Included Features:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                  {(detailsPackage.features as string[]).map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <Button type="button" size="sm" onClick={() => setDetailsPackage(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Archive Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(packageToArchive)}
        onClose={() => setPackageToArchive(null)}
        onConfirm={handleToggleArchive}
        title={packageToArchive?.isArchived ? 'Restore Service Package' : 'Archive Service Package'}
        message={
          packageToArchive?.isArchived
            ? `Are you sure you want to restore "${packageToArchive?.name}"? It will become visible in client onboarding packages.`
            : `Are you sure you want to archive "${packageToArchive?.name}"? It will no longer be offered for new client onboarding, but all existing client contracts remain intact.`
        }
        confirmText={packageToArchive?.isArchived ? 'Restore Package' : 'Archive Package'}
        variant={packageToArchive?.isArchived ? 'primary' : 'danger'}
        isLoading={isArchiving}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(packageToDelete)}
        onClose={() => setPackageToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Service Package"
        message={`Are you sure you want to delete "${packageToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Package"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
