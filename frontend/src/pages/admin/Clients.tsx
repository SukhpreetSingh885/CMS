import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Briefcase,
  Plus,
  Search,
  ArrowRight,
  ArrowLeft,
  Check,
  Building,
  Calendar,
  Layers,
  FileCheck,
  ChevronRight,
  Archive,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { clientService, packageService, userService } from '../../services';
import { Client, Package, ServiceItem, User } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { formatINR, formatDate } from '../../utils/formatters';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
  FilterDrawer,
} from '../../components/filters';

export const Clients: React.FC = () => {
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters, activeFiltersCount } =
    useSmartFilters({
      search: '',
      status: '',
      industry: '',
      assignedEmployeeId: '',
      packageId: '',
      serviceId: '',
      paymentStatus: '',
      dateRange: '',
      onboardingDateFrom: '',
      onboardingDateTo: '',
      renewalDateFrom: '',
      renewalDateTo: '',
    });

  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Multi-step Onboarding State
  const navigate = useNavigate();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [createdClientSuccess, setCreatedClientSuccess] = useState<Client | null>(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Archive dialog state
  const [clientToArchive, setClientToArchive] = useState<Client | null>(null);

  // Multi-step Form State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<any>({
    companyName: '',
    contactPerson: '',
    contactDesignation: '',
    mobileNumber: '',
    whatsAppNumber: '',
    email: '',
    website: '',
    instagram: '',
    city: '',
    industry: '',
    leadSource: '',
    contractStartDate: new Date().toISOString().slice(0, 10),
    contractEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    renewalDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    assignedAdminId: '',
    packageId: '',
    packagePricing: 0,
    billingCycle: 'MONTHLY',
    clientPriority: 'MEDIUM',
    clientGoals: '',
    services: [],
    generateFirstInvoice: true,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientRes, pkgRes, svcRes, empRes, adminRes] = await Promise.all([
        clientService.listClients({
          search: filters.search || undefined,
          status: filters.status || undefined,
          industry: filters.industry || undefined,
          assignedEmployeeId: filters.assignedEmployeeId || undefined,
          packageId: filters.packageId || undefined,
          serviceId: filters.serviceId || undefined,
          paymentStatus: filters.paymentStatus || undefined,
          dateRange: (filters.dateRange as any) || undefined,
          onboardingDateFrom: filters.onboardingDateFrom || undefined,
          onboardingDateTo: filters.onboardingDateTo || undefined,
          renewalDateFrom: filters.renewalDateFrom || undefined,
          renewalDateTo: filters.renewalDateTo || undefined,
          pageSize: 100,
        }),
        packageService.listPackages(),
        packageService.listServices(),
        userService.listEmployees({ pageSize: 100 }),
        userService.listAdmins({ pageSize: 10 }),
      ]);
      setClients(clientRes.data || []);
      setPackages(pkgRes || []);
      setServices(svcRes || []);
      setEmployees(empRes.data || []);
      setAdmins(adminRes.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    filters.search,
    filters.status,
    filters.industry,
    filters.assignedEmployeeId,
    filters.packageId,
    filters.serviceId,
    filters.paymentStatus,
    filters.dateRange,
    filters.onboardingDateFrom,
    filters.onboardingDateTo,
    filters.renewalDateFrom,
    filters.renewalDateTo,
  ]);

  const handleSelectPackage = (pkgId: string) => {
    const selectedPkg = packages.find((p) => p.id === pkgId);
    if (!selectedPkg) return;

    const initialServices =
      selectedPkg.packageServices?.map((ps) => {
        let deliverablesSummary = ps.deliverables;
        if (!deliverablesSummary && ps.deliverablesList && ps.deliverablesList.length > 0) {
          deliverablesSummary = ps.deliverablesList
            .map((d) => {
              if (d.deliverableType === 'FEATURE') {
                return `${d.name}: ${d.isIncluded !== false ? 'Included' : 'Excluded'}`;
              }
              return `${d.name}: ${d.quantity ?? 1} ${d.unit || ''}`.trim();
            })
            .join(', ');
        }

        return {
          serviceId: ps.serviceId,
          serviceName: ps.service.name,
          monthlyTarget: ps.monthlyTarget || 10,
          serviceWeight: Number(ps.defaultWeight) || 1.0,
          deliverables: deliverablesSummary || '',
          deliverablesConfig: ps.deliverablesList || null,
        };
      }) || [];

    const contractSnapshot = {
      packageId: selectedPkg.id,
      packageName: selectedPkg.name,
      packageType: selectedPkg.packageType,
      basePrice: Number(selectedPkg.basePrice),
      setupFee: Number(selectedPkg.setupFee || 0),
      billingCycle: selectedPkg.billingCycle,
      agreedPrice: Number(selectedPkg.basePrice),
      features: selectedPkg.features || [],
      services: selectedPkg.packageServices?.map((ps) => ({
        serviceId: ps.serviceId,
        serviceName: ps.service.name,
        monthlyTarget: ps.monthlyTarget,
        defaultWeight: Number(ps.defaultWeight),
        deliverablesSummary: ps.deliverables,
        deliverablesList: ps.deliverablesList || [],
      })) || [],
      capturedAt: new Date().toISOString(),
    };

    setFormData((prev: any) => ({
      ...prev,
      packageId: pkgId,
      packagePricing: Number(selectedPkg.basePrice),
      billingCycle: selectedPkg.billingCycle || 'MONTHLY',
      contractSnapshot,
      services: initialServices,
    }));
  };

  const STEP_FIELDS: Record<number, string[]> = {
    1: ['companyName', 'contactPerson', 'contactDesignation', 'mobileNumber', 'whatsAppNumber', 'email', 'website', 'instagram', 'city', 'industry', 'leadSource'],
    2: ['contractStartDate', 'contractEndDate', 'renewalDate', 'assignedAdminId', 'clientPriority', 'billingCycle', 'clientGoals'],
    3: ['packageId', 'packagePricing'],
    4: ['services'],
    5: ['generateFirstInvoice'],
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    setFormErrors({});

    try {
      // Clean payload: sanitize empty strings to undefined (Client & Package/Services only)
      const cleanPayload: any = {
        companyName: formData.companyName.trim(),
        contactPerson: formData.contactPerson.trim(),
        contactDesignation: formData.contactDesignation?.trim() || undefined,
        mobileNumber: formData.mobileNumber.trim(),
        whatsAppNumber: formData.whatsAppNumber?.trim() || undefined,
        email: formData.email.trim(),
        website: formData.website?.trim() || undefined,
        instagram: formData.instagram?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        industry: formData.industry?.trim() || undefined,
        leadSource: formData.leadSource?.trim() || undefined,
        contractStartDate: formData.contractStartDate,
        contractEndDate: formData.contractEndDate,
        renewalDate: formData.renewalDate,
        assignedAdminId: formData.assignedAdminId || undefined,
        packageId: formData.packageId || undefined,
        packagePricing: Number(formData.packagePricing) || 0,
        billingCycle: formData.billingCycle,
        contractSnapshot: formData.contractSnapshot || undefined,
        clientPriority: formData.clientPriority,
        clientGoals: formData.clientGoals?.trim() || undefined,
        generateFirstInvoice: Boolean(formData.generateFirstInvoice),
        services: (formData.services || []).map((s: any) => ({
          serviceId: s.serviceId,
          monthlyTarget: Number(s.monthlyTarget) || 10,
          serviceWeight: Number(s.serviceWeight) || 1.0,
          deliverables: s.deliverables || undefined,
          deliverablesConfig: s.deliverablesConfig || undefined,
        })),
      };

      const created = await clientService.createClient(cleanPayload);
      toast.success('Client created successfully. You can now assign employees to the client\'s services.');
      setCreatedClientSuccess(created);
      setFormErrors({});
      loadData();
    } catch (err: any) {
      if (err?.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        const errorMap: Record<string, string> = {};
        for (const e of err.errors) {
          errorMap[e.field] = e.message;
        }
        setFormErrors(errorMap);

        // Auto-navigate to the wizard step with the first error
        const firstField = err.errors[0]?.field;
        for (const [sNum, fields] of Object.entries(STEP_FIELDS)) {
          if (fields.some((f) => firstField === f || firstField.startsWith(f))) {
            setStep(Number(sNum));
            break;
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveClient = async () => {
    if (!clientToArchive) return;
    setIsSubmitting(true);
    try {
      await clientService.archiveClient(clientToArchive.id);
      toast.success('Client archived');
      setClientToArchive(null);
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) {
      list.push({ key: 'search', label: 'Search', value: filters.search });
    }
    if (filters.status) {
      list.push({ key: 'status', label: 'Status', value: filters.status });
    }
    if (filters.industry) {
      list.push({ key: 'industry', label: 'Industry', value: filters.industry });
    }
    if (filters.assignedEmployeeId) {
      const emp = employees.find((e) => e.id === filters.assignedEmployeeId);
      list.push({
        key: 'assignedEmployeeId',
        label: 'Staff',
        value: filters.assignedEmployeeId,
        displayValue: emp?.fullName || 'Assigned Staff',
      });
    }
    if (filters.packageId) {
      const pkg = packages.find((p) => p.id === filters.packageId);
      list.push({
        key: 'packageId',
        label: 'Package',
        value: filters.packageId,
        displayValue: pkg?.name || 'Selected Package',
      });
    }
    if (filters.paymentStatus) {
      list.push({ key: 'paymentStatus', label: 'Payment', value: filters.paymentStatus });
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
        label: 'Onboarding',
        value: presetLabels[filters.dateRange] || filters.dateRange,
      });
    } else if (filters.onboardingDateFrom || filters.onboardingDateTo) {
      list.push({
        key: 'onboardingDate',
        label: 'Onboarding',
        value: `${filters.onboardingDateFrom || ''} to ${filters.onboardingDateTo || ''}`,
      });
    }
    if (filters.renewalDateFrom || filters.renewalDateTo) {
      list.push({
        key: 'renewalDate',
        label: 'Renewal',
        value: `${filters.renewalDateFrom || ''} to ${filters.renewalDateTo || ''}`,
      });
    }
    return list;
  }, [filters, employees, packages]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dateRange' || key === 'onboardingDate') {
      setFilters({ dateRange: '', onboardingDateFrom: '', onboardingDateTo: '' });
    } else if (key === 'renewalDate') {
      setFilters({ renewalDateFrom: '', renewalDateTo: '' });
    } else {
      clearFilter(key);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients 360° Management"
        description="Comprehensive client accounts, service targets, and contract lifecycles."
        actions={
          <Button
            onClick={() => {
              setCreatedClientSuccess(null);
              setStep(1);
              setIsOnboardingOpen(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Onboard New Client
          </Button>
        }
      />

      {/* Unified Filter Toolbar */}
      <FilterToolbar
        dateFilter={
          <DateQuickFilter
            selectedPreset={filters.dateRange}
            startDate={filters.onboardingDateFrom}
            endDate={filters.onboardingDateTo}
            onChange={(preset, start, end) => {
              setFilters({
                dateRange: preset,
                onboardingDateFrom: start || '',
                onboardingDateTo: end || '',
              });
            }}
          />
        }
        totalResults={clients.length}
        resultsLabel="clients"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
        onOpenAdvanced={() => setIsAdvancedOpen(true)}
        advancedCount={
          [
            filters.industry,
            filters.assignedEmployeeId,
            filters.packageId,
            filters.paymentStatus,
            filters.renewalDateFrom,
          ].filter(Boolean).length
        }
        advancedLabel="Advanced Filters"
      >
        <SearchInput
          placeholder="Search company, contact, city, email..."
          value={filters.search}
          onChange={(val) => setFilter('search', val)}
          className="w-full sm:w-72"
        />

        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(val) => setFilter('status', val)}
          options={[
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Onboarding', value: 'ONBOARDING' },
            { label: 'Renewal Due', value: 'RENEWAL_DUE' },
            { label: 'Won', value: 'WON' },
            { label: 'Paused', value: 'PAUSED' },
            { label: 'Completed', value: 'COMPLETED' },
            { label: 'Archived', value: 'ARCHIVED' },
          ]}
        />

        <FilterSelect
          label="Assigned Staff"
          value={filters.assignedEmployeeId}
          onChange={(val) => setFilter('assignedEmployeeId', val)}
          options={employees.map((e) => ({ label: e.fullName, value: e.id }))}
        />

        <FilterSelect
          label="Package"
          value={filters.packageId}
          onChange={(val) => setFilter('packageId', val)}
          options={packages.map((p) => ({ label: p.name, value: p.id }))}
        />
      </FilterToolbar>

      {/* Advanced Filter Drawer */}
      <FilterDrawer
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
        title="Advanced Client Filters"
        onApply={() => setIsAdvancedOpen(false)}
        onReset={() => {
          clearAllFilters();
          setIsAdvancedOpen(false);
        }}
        activeFiltersCount={activeFiltersCount}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Industry / Niche</label>
            <input
              type="text"
              placeholder="e.g. E-Commerce, Healthcare, Real Estate"
              value={filters.industry}
              onChange={(e) => setFilter('industry', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <FilterSelect
            label="Payment Status"
            value={filters.paymentStatus}
            onChange={(val) => setFilter('paymentStatus', val)}
            options={[
              { label: 'Paid', value: 'PAID' },
              { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'Overdue', value: 'OVERDUE' },
            ]}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Renewal Date Preset</label>
            <DateQuickFilter
              startDate={filters.renewalDateFrom}
              endDate={filters.renewalDateTo}
              onChange={(_preset, start, end) => {
                setFilters({
                  renewalDateFrom: start || '',
                  renewalDateTo: end || '',
                });
              }}
            />
          </div>
        </div>
      </FilterDrawer>

      {isLoading ? (
        <LoadingState message="Loading client accounts..." />
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No clients match your filter criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search query, clearing specific filters, or resetting all filters.
          </p>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Reset All Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((client) => (
            <Card key={client.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/admin/clients/${client.id}`}
                      className="text-base font-bold text-slate-900 hover:text-purple-600 truncate block"
                    >
                      {client.companyName}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">{client.industry || 'Agency Retainer'}</p>
                  </div>
                  <StatusBadge status={client.status} />
                </div>

                {/* Delivery Progress Bar */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Delivery Completion</span>
                    <span className="font-bold text-slate-900">{client.deliveryProgress || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${client.deliveryProgress || 0}%` }}
                    />
                  </div>
                </div>

                {/* Contact and Pricing Details */}
                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Contact:</span>
                    <span className="font-semibold text-slate-800">{client.contactPerson}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Package:</span>
                    <span className="font-semibold text-purple-700">{client.package?.name || 'Custom'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      {client.billingCycle === 'ONE_TIME' ? 'Project Price:' : 'Monthly Retainer:'}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatINR(client.packagePricing)}
                      {client.billingCycle === 'ONE_TIME' ? (
                        <span className="text-[10px] text-amber-700 font-semibold ml-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          One-Time
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal ml-0.5">/mo</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      {client.billingCycle === 'ONE_TIME' ? 'Project Deadline:' : 'Renewal Date:'}
                    </span>
                    <span className="text-slate-700">
                      {client.billingCycle === 'ONE_TIME'
                        ? formatDate(client.contractEndDate)
                        : formatDate(client.renewalDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setClientToArchive(client)}
                  title="Archive Client"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Archive className="w-4 h-4" />
                </button>

                <Link
                  to={`/admin/clients/${client.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700"
                >
                  Client 360° Profile <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Multi-step Client Onboarding Modal */}
      <Modal
        isOpen={isOnboardingOpen}
        onClose={() => {
          setIsOnboardingOpen(false);
          setCreatedClientSuccess(null);
        }}
        title="Client Onboarding Wizard"
        description={
          createdClientSuccess
            ? 'Client Created — Ready for Service Team Assignment'
            : `Step ${step} of 5 — Complete client onboarding pipeline`
        }
        maxWidth="3xl"
      >
        <div className="space-y-6">
          {/* Step Progress Pills */}
          {!createdClientSuccess && (
            <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider">
              {['Basic Info', 'Contract', 'Package', 'Services', 'Review'].map((label, i) => (
                <div
                  key={label}
                  className={`py-1.5 rounded-lg border transition-all ${
                    step === i + 1
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : step > i + 1
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  {i + 1}. {label}
                </div>
              ))}
            </div>
          )}

          {/* STEP 1: Basic Company & Contact Information */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Company / Brand Name *"
                  placeholder="e.g. Aura Fashion Ltd."
                  value={formData.companyName}
                  error={formErrors.companyName}
                  onChange={(e) => {
                    setFormData({ ...formData, companyName: e.target.value });
                    if (formErrors.companyName) setFormErrors((prev) => ({ ...prev, companyName: '' }));
                  }}
                />
                <Input
                  label="Industry / Niche"
                  placeholder="e.g. E-Commerce & Retail"
                  value={formData.industry}
                  error={formErrors.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Contact Person *"
                  placeholder="e.g. Karan Malhotra"
                  value={formData.contactPerson}
                  error={formErrors.contactPerson}
                  onChange={(e) => {
                    setFormData({ ...formData, contactPerson: e.target.value });
                    if (formErrors.contactPerson) setFormErrors((prev) => ({ ...prev, contactPerson: '' }));
                  }}
                />
                <Input
                  label="Designation"
                  placeholder="e.g. Founder & CMO"
                  value={formData.contactDesignation}
                  error={formErrors.contactDesignation}
                  onChange={(e) => setFormData({ ...formData, contactDesignation: e.target.value })}
                />
                <Input
                  label="City"
                  placeholder="e.g. Mumbai"
                  value={formData.city}
                  error={formErrors.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Email Address *"
                  type="email"
                  placeholder="contact@aura.in"
                  value={formData.email}
                  error={formErrors.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: '' }));
                  }}
                />
                <Input
                  label="Mobile Number *"
                  placeholder="+91 9876543210"
                  value={formData.mobileNumber}
                  error={formErrors.mobileNumber}
                  onChange={(e) => {
                    setFormData({ ...formData, mobileNumber: e.target.value });
                    if (formErrors.mobileNumber) setFormErrors((prev) => ({ ...prev, mobileNumber: '' }));
                  }}
                />
                <Input
                  label="WhatsApp Number"
                  placeholder="+91 9876543210"
                  value={formData.whatsAppNumber}
                  error={formErrors.whatsAppNumber}
                  onChange={(e) => setFormData({ ...formData, whatsAppNumber: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Website URL"
                  placeholder="https://company.com"
                  value={formData.website}
                  error={formErrors.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
                <Input
                  label="Instagram Handle"
                  placeholder="@company"
                  value={formData.instagram}
                  error={formErrors.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Contract & Goals */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Contract Start Date *"
                  type="date"
                  value={formData.contractStartDate}
                  error={formErrors.contractStartDate}
                  onChange={(e) => {
                    setFormData({ ...formData, contractStartDate: e.target.value });
                    if (formErrors.contractStartDate) setFormErrors((prev) => ({ ...prev, contractStartDate: '' }));
                  }}
                />
                <Input
                  label="Contract End Date *"
                  type="date"
                  value={formData.contractEndDate}
                  error={formErrors.contractEndDate}
                  onChange={(e) => {
                    setFormData({ ...formData, contractEndDate: e.target.value });
                    if (formErrors.contractEndDate) setFormErrors((prev) => ({ ...prev, contractEndDate: '' }));
                  }}
                />
                <Input
                  label="Renewal Date *"
                  type="date"
                  value={formData.renewalDate}
                  error={formErrors.renewalDate}
                  onChange={(e) => {
                    setFormData({ ...formData, renewalDate: e.target.value });
                    if (formErrors.renewalDate) setFormErrors((prev) => ({ ...prev, renewalDate: '' }));
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Assigned Admin</label>
                  <select
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                    value={formData.assignedAdminId}
                    onChange={(e) => setFormData({ ...formData, assignedAdminId: e.target.value })}
                  >
                    <option value="">Select Account Manager (Admin)</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.fullName} ({a.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Client Priority</label>
                  <select
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                    value={formData.clientPriority}
                    onChange={(e) => setFormData({ ...formData, clientPriority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent (VIP)</option>
                  </select>
                </div>
              </div>

              <Textarea
                label="Client Growth Goals & Key Deliverable Objectives"
                placeholder="e.g. Generate 500 Qualified Leads/month with 4.5x ROAS on Meta ads..."
                value={formData.clientGoals}
                onChange={(e) => setFormData({ ...formData, clientGoals: e.target.value })}
              />
            </div>
          )}

          {/* STEP 3: Package Selection */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {packages.map((pkg) => {
                  const isSelected = formData.packageId === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => handleSelectPackage(pkg.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{pkg.name}</h4>
                        {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider inline-block mt-1 ${
                          pkg.packageType === 'COMBINED_BUSINESS'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {pkg.packageType === 'COMBINED_BUSINESS' ? 'Combined Business' : 'Single Service'}
                      </span>
                      <p className="text-sm font-extrabold text-slate-900 mt-1.5">
                        {formatINR(pkg.basePrice)}
                        <span className="text-[10px] text-slate-500 font-normal">
                          {pkg.billingCycle === 'ONE_TIME' ? ' / project' : ' /mo'}
                        </span>
                      </p>
                      {pkg.setupFee && Number(pkg.setupFee) > 0 ? (
                        <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-semibold inline-block mt-0.5">
                          + {formatINR(pkg.setupFee)} Setup Fee
                        </span>
                      ) : null}
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{pkg.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Input
                  label={
                    formData.billingCycle === 'ONE_TIME'
                      ? 'Total Project Price (₹ INR)'
                      : 'Package Monthly Retainer Pricing (₹ INR)'
                  }
                  type="number"
                  value={formData.packagePricing}
                  error={formErrors.packagePricing}
                  onChange={(e) => {
                    setFormData({ ...formData, packagePricing: e.target.value });
                    if (formErrors.packagePricing) setFormErrors((prev) => ({ ...prev, packagePricing: '' }));
                  }}
                />

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Billing Type</label>
                  <select
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                  >
                    <option value="ONE_TIME">One-Time (Project)</option>
                    <option value="MONTHLY">Monthly (Recurring)</option>
                    <option value="QUARTERLY">Quarterly (Recurring)</option>
                    <option value="YEARLY">Yearly (Recurring)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Service & Deliverable Configuration (Client & Package Only) */}
          {!createdClientSuccess && step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {formData.billingCycle === 'ONE_TIME'
                    ? 'Configure purchased services and agreed project deliverable targets. Service teams will be assigned after onboarding.'
                    : 'Configure purchased services and agreed monthly deliverable targets. Service teams will be assigned after onboarding.'}
                </p>

                {/* Allow adding additional custom services from Services Master */}
                <select
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                  value=""
                  onChange={(e) => {
                    const svcId = e.target.value;
                    if (!svcId) return;
                    const found = services.find((s) => s.id === svcId);
                    if (!found) return;
                    if ((formData.services || []).some((s: any) => s.serviceId === svcId)) return;
                    setFormData({
                      ...formData,
                      services: [
                        ...(formData.services || []),
                        {
                          serviceId: found.id,
                          serviceName: found.name,
                          monthlyTarget: 10,
                          serviceWeight: 1.0,
                          deliverables: found.description || '',
                          deliverablesConfig: null,
                        },
                      ],
                    });
                  }}
                >
                  <option value="">+ Add Service...</option>
                  {services
                    .filter(
                      (s) =>
                        s.isActive !== false &&
                        !(formData.services || []).some((sel: any) => sel.serviceId === s.id)
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                {(!formData.services || formData.services.length === 0) ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs font-semibold text-slate-700">No services selected yet</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Select a package in Step 3 or add individual services using the dropdown above.
                    </p>
                  </div>
                ) : (
                  formData.services.map((svc: any, idx: number) => (
                    <div
                      key={svc.serviceId || idx}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center">
                        <div className="sm:col-span-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900">{svc.serviceName}</p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                              Included Service
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                            {formData.billingCycle === 'ONE_TIME' ? 'Total Project Target' : 'Monthly Target'}
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded"
                            value={svc.monthlyTarget}
                            onChange={(e) => {
                              const updated = [...formData.services];
                              updated[idx].monthlyTarget = Number(e.target.value);
                              setFormData({ ...formData, services: updated });
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                            Weight Factor
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded"
                            value={svc.serviceWeight}
                            onChange={(e) => {
                              const updated = [...formData.services];
                              updated[idx].serviceWeight = Number(e.target.value);
                              setFormData({ ...formData, services: updated });
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                          Agreed Deliverables / Scope Summary
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 12 Reels, 15 Static Posts, Monthly Analytics Report"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded"
                          value={svc.deliverables || ''}
                          onChange={(e) => {
                            const updated = [...formData.services];
                            updated[idx].deliverables = e.target.value;
                            setFormData({ ...formData, services: updated });
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Review & Onboard */}
          {!createdClientSuccess && step === 5 && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-xs space-y-2">
                <h4 className="font-bold text-purple-900 text-sm">Onboarding Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700 pt-2 border-t border-purple-200/60">
                  <p>
                    <span className="font-medium text-slate-500">Company:</span> {formData.companyName}
                  </p>
                  <p>
                    <span className="font-medium text-slate-500">Contact:</span> {formData.contactPerson} ({formData.email})
                  </p>
                  <p>
                    <span className="font-medium text-slate-500">
                      {formData.billingCycle === 'ONE_TIME' ? 'Project Price:' : 'Monthly Retainer:'}
                    </span>{' '}
                    <span className="font-bold text-purple-700">{formatINR(formData.packagePricing)}</span>
                    {formData.contractSnapshot?.setupFee && Number(formData.contractSnapshot.setupFee) > 0 ? (
                      <span className="text-[11px] text-slate-500 block">
                        + {formatINR(formData.contractSnapshot.setupFee)} Setup Fee
                      </span>
                    ) : null}
                  </p>
                  <p>
                    <span className="font-medium text-slate-500">Services Included:</span> {formData.services?.length || 0} services
                  </p>
                </div>

                {formData.services?.length > 0 && (
                  <div className="pt-2 border-t border-purple-200/60 space-y-1.5">
                    <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                      Purchased Services & Agreed Targets
                    </span>
                    {formData.services.map((s: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] bg-white/80 px-2.5 py-1.5 rounded-lg border border-purple-100"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{s.serviceName}</span>
                          {s.deliverables && (
                            <span className="text-slate-500 ml-2 text-[10px]">({s.deliverables})</span>
                          )}
                        </div>
                        <span className="text-purple-700 font-semibold">
                          Target: {s.monthlyTarget}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center gap-2">
                <input
                  type="checkbox"
                  id="genInv"
                  checked={formData.generateFirstInvoice}
                  onChange={(e) => setFormData({ ...formData, generateFirstInvoice: e.target.checked })}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="genInv" className="font-medium text-slate-800 cursor-pointer">
                  Automatically generate the first onboarding invoice ({formatINR(formData.packagePricing)})
                </label>
              </div>
            </div>
          )}

          {/* Post-Onboarding Confirmation State */}
          {createdClientSuccess && (
            <div className="p-6 bg-emerald-50/70 rounded-2xl border border-emerald-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  {createdClientSuccess.companyName} Onboarded
                </h4>
                <p className="text-xs font-medium text-emerald-800">
                  Client created successfully. You can now assign employees to the client's services.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const id = createdClientSuccess.id;
                    setIsOnboardingOpen(false);
                    setCreatedClientSuccess(null);
                    setStep(1);
                    navigate(`/admin/clients/${id}`);
                  }}
                >
                  View Client
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const id = createdClientSuccess.id;
                    setIsOnboardingOpen(false);
                    setCreatedClientSuccess(null);
                    setStep(1);
                    navigate(`/admin/clients/${id}?tab=services`);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" /> Assign Employees
                </Button>
              </div>
            </div>
          )}

          {/* Modal Navigation Buttons */}
          {!createdClientSuccess && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              {step > 1 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Previous
                </Button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (step === 1 && (!formData.companyName || !formData.email || !formData.mobileNumber)) {
                      toast.error('Please fill company name, email, and mobile number');
                      return;
                    }
                    setStep(step + 1);
                  }}
                >
                  Next Step <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleFinishOnboarding}
                  isLoading={isSubmitting}
                >
                  Complete Onboarding
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Archive Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(clientToArchive)}
        onClose={() => setClientToArchive(null)}
        onConfirm={handleArchiveClient}
        title="Archive Client Account"
        message={`Are you sure you want to archive ${clientToArchive?.companyName}? Historical business records, task history, and past invoices will remain preserved.`}
        confirmText="Archive Client"
        variant="danger"
        isLoading={isSubmitting}
      />
    </div>
  );
};

