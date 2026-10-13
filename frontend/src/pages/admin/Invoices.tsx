import React, { useState, useEffect } from 'react';
import { financeService, clientService } from '../../services';
import { Invoice, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { formatINR, formatDate } from '../../utils/formatters';
import { Receipt, Plus, CreditCard, History, Ban, CheckCircle2, Download, Printer, Eye, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
  FilterDrawer,
} from '../../components/filters';

export const Invoices: React.FC = () => {
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters, activeFiltersCount } =
    useSmartFilters({
      search: '',
      clientId: '',
      status: '',
      dateRange: '',
      startDate: '',
      endDate: '',
      dueDateFrom: '',
      dueDateTo: '',
      isOverdue: '',
    });

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Create Invoice Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Installment History & Reversal Modal
  const [historyInvoice, setHistoryInvoice] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // View Invoice Modal
  const [viewInvoice, setViewInvoice] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Safe Delete Modal
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState<Invoice | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isPurgeTestDuplicate, setIsPurgeTestDuplicate] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cancel / Void Modal
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<Invoice | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Action Loading states
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [printingInvoiceId, setPrintingInvoiceId] = useState<string | null>(null);

  const [invoiceForm, setInvoiceForm] = useState({
    clientId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    invoiceAmount: 0,
    notes: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'BANK_TRANSFER' as any,
    transactionReference: '',
    notes: '',
  });

  const handleVoidPayment = async (paymentId: string) => {
    if (!voidReason.trim()) {
      toast.error('Please enter a reason for voiding/reversing this installment');
      return;
    }
    setIsVoiding(true);
    try {
      await financeService.voidPayment(paymentId, { voidReason: voidReason.trim() });
      toast.success('Payment installment voided and invoice balance restored');
      setVoidingPaymentId(null);
      setVoidReason('');
      setIsHistoryOpen(false);
      window.dispatchEvent(new CustomEvent('finance-data-updated'));
      loadData();
    } finally {
      setIsVoiding(false);
    }
  };

  const handleDownloadPdf = async (inv: Invoice) => {
    setDownloadingInvoiceId(inv.id);
    try {
      await financeService.downloadInvoicePdf(inv.id, `Viralstan_Invoice_${inv.invoiceNumber}.pdf`);
      toast.success(`Downloaded PDF for ${inv.invoiceNumber}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to download invoice PDF');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handlePrintPdf = async (inv: Invoice) => {
    setPrintingInvoiceId(inv.id);
    try {
      await financeService.printInvoicePdf(inv.id);
      toast.success(`Sent ${inv.invoiceNumber} to printer`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to print invoice');
    } finally {
      setPrintingInvoiceId(null);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteInvoiceTarget) return;
    if (deleteConfirmText.trim() !== 'DELETE') {
      toast.error('You must type "DELETE" exactly to confirm invoice deletion');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await financeService.deleteInvoice(deleteInvoiceTarget.id, {
        confirmation: 'DELETE',
        cleanTestPayments: isPurgeTestDuplicate,
        reason: isPurgeTestDuplicate ? 'Test duplicate cleanup' : undefined,
      });
      toast.success(res.message || `Invoice ${deleteInvoiceTarget.invoiceNumber} deleted successfully`);
      setIsDeleteOpen(false);
      setDeleteInvoiceTarget(null);
      setDeleteConfirmText('');
      setIsPurgeTestDuplicate(false);
      window.dispatchEvent(new CustomEvent('finance-data-updated'));
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete invoice');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancelInvoiceTarget) return;
    if (!cancelReasonText.trim() || cancelReasonText.trim().length < 5) {
      toast.error('Please enter a cancellation reason of at least 5 characters');
      return;
    }
    setIsCancelling(true);
    try {
      const res = await financeService.cancelInvoice(cancelInvoiceTarget.id, { cancelReason: cancelReasonText.trim() });
      toast.success(res.message || `Invoice ${cancelInvoiceTarget.invoiceNumber} cancelled successfully`);
      if (res.data?.paymentNotice) {
        toast.info(res.data.paymentNotice, { duration: 6000 });
      }
      setIsCancelOpen(false);
      setCancelInvoiceTarget(null);
      setCancelReasonText('');
      window.dispatchEvent(new CustomEvent('finance-data-updated'));
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setIsCancelling(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invRes, clientRes] = await Promise.all([
        financeService.listInvoices({
          search: filters.search || undefined,
          clientId: filters.clientId || undefined,
          status: filters.status || undefined,
          dateRange: (filters.dateRange as any) || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          dueDateFrom: filters.dueDateFrom || undefined,
          dueDateTo: filters.dueDateTo || undefined,
          isOverdue: filters.isOverdue === 'true' ? true : undefined,
          pageSize: 100,
        }),
        clientService.listClients({ pageSize: 100 }),
      ]);
      setInvoices(invRes.data || []);
      setClients(clientRes.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('finance-data-updated', handleUpdate);
    return () => {
      window.removeEventListener('finance-data-updated', handleUpdate);
    };
  }, [
    filters.search,
    filters.clientId,
    filters.status,
    filters.dateRange,
    filters.startDate,
    filters.endDate,
    filters.dueDateFrom,
    filters.dueDateTo,
    filters.isOverdue,
  ]);

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.clientId) {
      const c = clients.find((client) => client.id === filters.clientId);
      list.push({ key: 'clientId', label: 'Client', value: filters.clientId, displayValue: c?.companyName });
    }
    if (filters.status) list.push({ key: 'status', label: 'Status', value: filters.status });
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
    } else if (filters.startDate || filters.endDate) {
      list.push({
        key: 'invoiceDate',
        label: 'Invoice Date',
        value: `${filters.startDate || ''} to ${filters.endDate || ''}`,
      });
    }
    if (filters.dueDateFrom || filters.dueDateTo) {
      list.push({
        key: 'dueDate',
        label: 'Due Date',
        value: `${filters.dueDateFrom || ''} to ${filters.dueDateTo || ''}`,
      });
    }
    return list;
  }, [filters, clients]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dateRange' || key === 'invoiceDate') {
      setFilters({ dateRange: '', startDate: '', endDate: '' });
    } else if (key === 'dueDate') {
      setFilters({ dueDateFrom: '', dueDateTo: '' });
    } else {
      clearFilter(key);
    }
  };

  const handleOpenCreate = () => {
    const code = Math.floor(1000 + Math.random() * 9000);
    setInvoiceForm({
      clientId: '',
      invoiceNumber: `INV-${new Date().getFullYear()}-${code}`,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      invoiceAmount: 0,
      notes: '',
    });
    setIsCreateOpen(true);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await financeService.createInvoice({
        ...invoiceForm,
        invoiceAmount: Number(invoiceForm.invoiceAmount),
      });
      toast.success('Invoice generated successfully');
      setIsCreateOpen(false);
      window.dispatchEvent(new CustomEvent('finance-data-updated'));
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amt = Number(paymentForm.amount);
    const balance = Number(selectedInvoice.remainingBalance);

    if (amt <= 0) {
      toast.error('Payment amount must be greater than 0');
      return;
    }

    if (amt > balance) {
      toast.error(`Payment amount cannot exceed remaining balance of ${formatINR(balance)}`);
      return;
    }

    const needsRef = ['BANK_TRANSFER', 'UPI', 'CREDIT_CARD', 'CHEQUE'].includes(paymentForm.paymentMethod);
    if (needsRef && !paymentForm.transactionReference.trim()) {
      toast.error('Transaction reference (UTR / IMPS / Cheque #) is required for this payment method');
      return;
    }

    setIsSubmitting(true);
    try {
      await financeService.recordPayment({
        invoiceId: selectedInvoice.id,
        amount: amt,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        transactionReference: paymentForm.transactionReference.trim() || undefined,
        notes: paymentForm.notes?.trim() || undefined,
      });
      toast.success('Payment recorded and invoice balance updated successfully');
      setIsPaymentOpen(false);
      setSelectedInvoice(null);
      window.dispatchEvent(new CustomEvent('finance-data-updated'));
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Billing Management"
        description="Generate client invoices, track outstanding balances, and record payments."
        actions={
          <Button onClick={handleOpenCreate} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Generate Invoice
          </Button>
        }
      />

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
        totalResults={invoices.length}
        resultsLabel="invoices"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
        onOpenAdvanced={() => setIsAdvancedOpen(true)}
        advancedCount={
          [filters.dueDateFrom].filter(Boolean).length
        }
        advancedLabel="Advanced Filters"
      >
        <SearchInput
          placeholder="Search by invoice # or client name..."
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
          label="Payment Status"
          value={filters.status}
          onChange={(val) => setFilter('status', val)}
          options={[
            { label: 'Paid', value: 'PAID' },
            { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
            { label: 'Pending', value: 'PENDING' },
            { label: 'Overdue', value: 'OVERDUE' },
            { label: 'Cancelled', value: 'CANCELLED' },
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
        title="Advanced Invoice Filters"
        onApply={() => setIsAdvancedOpen(false)}
        onReset={() => {
          clearAllFilters();
          setIsAdvancedOpen(false);
        }}
        activeFiltersCount={activeFiltersCount}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Due Date Preset</label>
            <DateQuickFilter
              startDate={filters.dueDateFrom}
              endDate={filters.dueDateTo}
              onChange={(_preset, start, end) => {
                setFilters({
                  dueDateFrom: start || '',
                  dueDateTo: end || '',
                });
              }}
            />
          </div>
        </div>
      </FilterDrawer>

      {isLoading ? (
        <LoadingState message="Loading invoices & billing data..." />
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No invoices match your filter criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search query, clearing status filters, or resetting all filters.
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
                <th className="py-3 px-5">Invoice #</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Amount Paid</th>
                <th className="py-3 px-4">Remaining Balance</th>
                <th className="py-3 px-4">Paid %</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => {
                const percent = Number(inv.invoiceAmount) > 0 
                  ? Math.min(100, Math.round((Number(inv.amountPaid) / Number(inv.invoiceAmount)) * 100)) 
                  : 0;

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-bold text-purple-700">
                      {inv.invoiceNumber}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {inv.client?.companyName}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{formatDate(inv.dueDate)}</td>

                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">{formatINR(inv.invoiceAmount)}</td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-600 whitespace-nowrap">{formatINR(inv.amountPaid)}</td>
                    <td className="py-3.5 px-4 font-bold text-rose-600 whitespace-nowrap">{formatINR(inv.remainingBalance)}</td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${percent >= 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-purple-600' : 'bg-slate-300'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="font-semibold text-[10px] text-slate-600">{percent}%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={inv.paymentStatus} />
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Preview */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setViewInvoice(inv);
                            setIsViewOpen(true);
                          }}
                          className="text-xs text-slate-700 px-2 py-1 hover:bg-slate-100"
                          title="View Invoice Details"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" /> View
                        </Button>

                        {/* Download PDF */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPdf(inv)}
                          isLoading={downloadingInvoiceId === inv.id}
                          className="text-xs text-slate-700 px-2 py-1 hover:bg-slate-100"
                          title="Download Official PDF"
                        >
                          <Download className="w-3.5 h-3.5 mr-1 text-purple-600" /> PDF
                        </Button>

                        {/* Delete or Void */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeleteInvoiceTarget(inv);
                            setDeleteConfirmText('');
                            setIsPurgeTestDuplicate(false);
                            setIsDeleteOpen(true);
                          }}
                          className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200 px-2 py-1"
                          title="Delete / Void Invoice"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" /> Delete
                        </Button>

                        {/* Print */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintPdf(inv)}
                          isLoading={printingInvoiceId === inv.id}
                          className="text-xs text-slate-700 px-2 py-1 hover:bg-slate-100"
                          title="Print Invoice"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1 text-slate-500" /> Print
                        </Button>

                        {/* Installments History */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setHistoryInvoice(inv);
                            setIsHistoryOpen(true);
                          }}
                          className="text-xs text-slate-600 px-2 py-1"
                          title="View installment history and reversals"
                        >
                          <History className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                          History ({inv.payments?.length || 0})
                        </Button>

                        {/* Record Payment */}
                        {inv.paymentStatus !== 'CANCELLED' && inv.paymentStatus !== 'VOID' && inv.remainingBalance > 0 ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPaymentForm({
                                amount: inv.remainingBalance,
                                paymentDate: new Date().toISOString().slice(0, 10),
                                paymentMethod: 'BANK_TRANSFER',
                                transactionReference: '',
                                notes: '',
                              });
                              setIsPaymentOpen(true);
                            }}
                            className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                            title="Record Installment Payment"
                          >
                            <CreditCard className="w-3.5 h-3.5 mr-1" /> Pay
                          </Button>
                        ) : inv.paymentStatus === 'CANCELLED' || inv.paymentStatus === 'VOID' ? (
                          <span className="text-xs font-semibold text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">Cancelled</span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-600 px-2 py-1">Settled</span>
                        )}

                        {/* Cancel / Void Invoice */}
                        {inv.paymentStatus !== 'CANCELLED' && inv.paymentStatus !== 'VOID' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCancelInvoiceTarget(inv);
                              setCancelReasonText('');
                              setIsCancelOpen(true);
                            }}
                            className="text-xs text-amber-700 hover:bg-amber-50 border-amber-200 px-2 py-1"
                            title="Cancel / Void Invoice"
                          >
                            <Ban className="w-3.5 h-3.5 mr-1 text-amber-600" /> Cancel
                          </Button>
                        )}
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

      {/* Generate Invoice Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Generate Client Invoice"
        description="Create an invoice with due date and billing amount"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Client *</label>
              <select
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                value={invoiceForm.clientId}
                onChange={(e) => {
                  const cl = clients.find((c) => c.id === e.target.value);
                  setInvoiceForm({
                    ...invoiceForm,
                    clientId: e.target.value,
                    invoiceAmount: cl?.packagePricing || 0,
                  });
                }}
                required
              >
                <option value="">Select Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} {c.billingCycle === 'ONE_TIME' ? '(One-Time Project)' : '(Recurring Retainer)'}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Invoice Number *"
              value={invoiceForm.invoiceNumber}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Invoice Amount (₹ INR) *"
              type="number"
              value={invoiceForm.invoiceAmount}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceAmount: Number(e.target.value) })}
              required
            />
            <Input
              label="Invoice Date *"
              type="date"
              value={invoiceForm.invoiceDate}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
              required
            />
            <Input
              label="Due Date *"
              type="date"
              value={invoiceForm.dueDate}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="Invoice Notes"
            placeholder="Payment instructions, bank details, or description..."
            value={invoiceForm.notes}
            onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Generate Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          title={`Record Payment for ${selectedInvoice.invoiceNumber}`}
          description={`Client: ${selectedInvoice.client?.companyName} • Balance: ${formatINR(selectedInvoice.remainingBalance)} • Milestone / Partial payments supported without altering agreed price`}
          maxWidth="md"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-xs text-purple-900 space-y-1">
              <div className="flex justify-between">
                <span>Agreed Invoice Amount:</span>
                <span className="font-bold">{formatINR(selectedInvoice.invoiceAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Already Collected:</span>
                <span className="font-bold text-emerald-600">{formatINR(selectedInvoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-purple-200 font-bold">
                <span>Remaining Payable Balance:</span>
                <span className="text-purple-700">{formatINR(selectedInvoice.remainingBalance)}</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-600 block">Quick Installment Presets:</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const half = Math.round(Number(selectedInvoice.invoiceAmount) * 0.5);
                    setPaymentForm({
                      ...paymentForm,
                      amount: Math.min(half, Number(selectedInvoice.remainingBalance)),
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg border border-purple-200 transition-colors"
                >
                  50% Advance (Half)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const quarter = Math.round(Number(selectedInvoice.invoiceAmount) * 0.25);
                    setPaymentForm({
                      ...paymentForm,
                      amount: Math.min(quarter, Number(selectedInvoice.remainingBalance)),
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-200 transition-colors"
                >
                  25% Milestone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentForm({
                      ...paymentForm,
                      amount: Number(selectedInvoice.remainingBalance),
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 transition-colors"
                >
                  Full Balance ({formatINR(selectedInvoice.remainingBalance)})
                </button>
              </div>
            </div>

            <div>
              <Input
                label="Payment Amount (₹ INR) *"
                type="number"
                min={1}
                max={Number(selectedInvoice.remainingBalance)}
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                required
              />
              {paymentForm.amount > 0 && (
                <div className="mt-1 text-[11px] text-slate-500 flex justify-between px-1">
                  <span>After this installment, balance will be:</span>
                  <span className="font-bold text-purple-700">
                    {formatINR(Math.max(0, Number(selectedInvoice.remainingBalance) - Number(paymentForm.amount)))}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Payment Date *"
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                required
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method *</label>
                <select
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">UPI (GPay / PhonePe)</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
            </div>

            <Input
              label={
                ['BANK_TRANSFER', 'UPI', 'CREDIT_CARD', 'CHEQUE'].includes(paymentForm.paymentMethod)
                  ? 'Transaction Reference ID (UTR / IMPS / Cheque #) *'
                  : 'Transaction / Receipt ID (Optional for Cash)'
              }
              placeholder={
                ['BANK_TRANSFER', 'UPI'].includes(paymentForm.paymentMethod)
                  ? 'e.g. UTR / IMPS reference number (12+ digits)'
                  : paymentForm.paymentMethod === 'CHEQUE'
                  ? 'e.g. Cheque number & Bank branch'
                  : 'e.g. Cash receipt voucher number'
              }
              value={paymentForm.transactionReference}
              onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
              required={['BANK_TRANSFER', 'UPI', 'CREDIT_CARD', 'CHEQUE'].includes(paymentForm.paymentMethod)}
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                Save Installment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Installment History & Reversal Modal */}
      {historyInvoice && (
        <Modal
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setHistoryInvoice(null);
            setVoidingPaymentId(null);
            setVoidReason('');
          }}
          title={`Installment Payment History — ${historyInvoice.invoiceNumber}`}
          description={`Client: ${historyInvoice.client?.companyName} • Agreed Project Price: ${formatINR(historyInvoice.invoiceAmount)}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* KPI Summary */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-500 block">Agreed Total Price</span>
                <span className="font-bold text-slate-900 text-sm">{formatINR(historyInvoice.invoiceAmount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Collected</span>
                <span className="font-bold text-emerald-600 text-sm">{formatINR(historyInvoice.amountPaid)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Remaining Balance</span>
                <span className="font-bold text-rose-600 text-sm">{formatINR(historyInvoice.remainingBalance)}</span>
              </div>
            </div>

            {/* Installments Table */}
            <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Transaction / UTR</th>
                    <th className="py-2.5 px-3">Received By</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!historyInvoice.payments || historyInvoice.payments.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No installment payments recorded yet for this invoice.
                      </td>
                    </tr>
                  ) : (
                    historyInvoice.payments.map((p: any) => (
                      <React.Fragment key={p.id}>
                        <tr className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600 whitespace-nowrap">{formatINR(p.amount)}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {p.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                            {p.transactionReference || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{p.receivedBy?.fullName || '-'}</td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingPaymentId(voidingPaymentId === p.id ? null : p.id);
                                setVoidReason('');
                              }}
                              className="text-[11px] text-rose-600 hover:text-rose-700 font-medium hover:underline inline-flex items-center gap-1"
                            >
                              <Ban className="w-3 h-3" /> Void / Reversal
                            </button>
                          </td>
                        </tr>
                        {voidingPaymentId === p.id && (
                          <tr className="bg-rose-50/60">
                            <td colSpan={6} className="p-3">
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-rose-800">
                                  Reason for Voiding Payment of {formatINR(p.amount)}:
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="e.g. Cheque bounced / duplicate entry / correction..."
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-rose-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setVoidingPaymentId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    isLoading={isVoiding}
                                    onClick={() => handleVoidPayment(p.id)}
                                    className="bg-rose-600 hover:bg-rose-700 text-white"
                                  >
                                    Confirm Reversal
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsHistoryOpen(false);
                  setHistoryInvoice(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 1. View Invoice Modal */}
      {viewInvoice && (
        <Modal
          isOpen={isViewOpen}
          onClose={() => {
            setIsViewOpen(false);
            setViewInvoice(null);
          }}
          title={`Invoice ${viewInvoice.invoiceNumber}`}
          description="Detailed breakdown, client billing data, and installment transactions."
          maxWidth="3xl"
        >
          <div className="space-y-5 text-xs">
            {/* Header / Brand Banner */}
            <div className="flex items-start justify-between p-4 bg-purple-50/50 border border-purple-100 rounded-xl">
              <div>
                <span className="text-base font-black text-purple-700 tracking-wider">VIRALSTAN</span>
                <p className="text-[11px] text-slate-500 font-medium">Digital Marketing & Growth Solutions</p>
                <div className="mt-2 text-slate-600 space-y-0.5 text-[11px]">
                  <p><span className="font-semibold text-slate-700">Client:</span> {viewInvoice.client?.companyName}</p>
                  <p><span className="font-semibold text-slate-700">Contact:</span> {viewInvoice.client?.contactPerson} ({viewInvoice.client?.email})</p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <StatusBadge status={viewInvoice.paymentStatus} />
                <p className="font-mono text-[11px] text-slate-500">Issued: {formatDate(viewInvoice.invoiceDate || viewInvoice.createdAt)}</p>
                <p className="font-mono text-[11px] font-semibold text-slate-700">Due: {formatDate(viewInvoice.dueDate)}</p>
              </div>
            </div>

            {/* Financial Metrics Cards */}
            <div className="grid grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Subtotal</span>
                <span className="text-sm font-bold text-slate-900">{formatINR(viewInvoice.invoiceAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Invoice Total</span>
                <span className="text-sm font-bold text-purple-700">{formatINR(viewInvoice.invoiceAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Received</span>
                <span className="text-sm font-bold text-emerald-600">{formatINR(viewInvoice.amountPaid)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Due</span>
                <span className={`text-sm font-bold ${Number(viewInvoice.remainingBalance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatINR(viewInvoice.remainingBalance)}
                </span>
              </div>
            </div>

            {/* Invoice Notes if any */}
            {viewInvoice.notes && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">Invoice Notes:</span>
                <p className="text-slate-600">{viewInvoice.notes}</p>
              </div>
            )}

            {/* Cancellation Notice if cancelled */}
            {(viewInvoice.isCancelled || viewInvoice.paymentStatus === 'CANCELLED' || viewInvoice.paymentStatus === 'VOID') && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                <span className="font-bold flex items-center gap-1.5 text-xs text-rose-700">
                  <Ban className="w-3.5 h-3.5" /> Invoice Cancelled / Voided
                </span>
                <p className="text-[11px] mt-0.5">Reason: {viewInvoice.cancelReason || 'Administrative cancellation'}</p>
              </div>
            )}

            {/* Installments Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 text-xs">Payment Transactions ({viewInvoice.payments?.length || 0})</h4>
                <span className="text-[11px] text-slate-500">Real-time synchronized with ledger</span>
              </div>
              <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80 uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">Transaction / UTR</th>
                      <th className="py-2 px-3">Received By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!viewInvoice.payments || viewInvoice.payments.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                          No payments recorded yet against this invoice.
                        </td>
                      </tr>
                    ) : (
                      viewInvoice.payments.map((p: any) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 text-slate-600">{formatDate(p.paymentDate)}</td>
                          <td className="py-2 px-3 font-bold text-emerald-600">{formatINR(p.amount)}</td>
                          <td className="py-2 px-3">{p.paymentMethod}</td>
                          <td className="py-2 px-3 font-mono text-[11px]">{p.transactionReference || '-'}</td>
                          <td className="py-2 px-3 text-slate-600">{p.receivedBy?.fullName || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bank Remittance Details */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
              <span className="font-bold text-purple-700 block mb-1">Official Remittance Details:</span>
              <p>HDFC Bank Ltd • A/C No: 50200084729183 • IFSC: HDFC0001234 • UPI: viralstan@hdfcbank</p>
              <p className="text-slate-400 text-[10px] mt-0.5">* Please quote {viewInvoice.invoiceNumber} in transaction remarks when remitting payment.</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadPdf(viewInvoice)}
                  isLoading={downloadingInvoiceId === viewInvoice.id}
                  className="text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-purple-600" /> Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrintPdf(viewInvoice)}
                  isLoading={printingInvoiceId === viewInvoice.id}
                  className="text-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1 text-slate-600" /> Print
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsViewOpen(false);
                  setViewInvoice(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Safe Delete Confirmation Modal */}
      {deleteInvoiceTarget && (
        <Modal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setDeleteInvoiceTarget(null);
            setDeleteConfirmText('');
            setIsPurgeTestDuplicate(false);
          }}
          title="Delete Invoice Confirmation"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {/* Warning Banner */}
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-900 text-xs">Are you sure you want to delete this invoice?</h4>
                <p className="text-rose-700 text-[11px] mt-0.5">Permanent deletion removes the invoice record.</p>
              </div>
            </div>

            {/* Target Invoice Details */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-mono font-bold text-purple-700">{deleteInvoiceTarget.invoiceNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Client Name:</span>
                <span className="font-bold text-slate-900">{deleteInvoiceTarget.client?.companyName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-bold text-slate-900">{formatINR(deleteInvoiceTarget.invoiceAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Current Payment Status:</span>
                <StatusBadge status={deleteInvoiceTarget.paymentStatus} />
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/80">
                <span className="text-slate-500 font-medium">Linked Payment Records:</span>
                <span className="font-bold text-slate-900">
                  {deleteInvoiceTarget.payments?.length || 0} payment(s)
                  {Number(deleteInvoiceTarget.amountPaid) > 0 && ` (${formatINR(deleteInvoiceTarget.amountPaid)} collected)`}
                </span>
              </div>
            </div>

            {/* Safe Deletion / Test Duplicate Cleanup Workflows */}
            {((deleteInvoiceTarget.payments && deleteInvoiceTarget.payments.length > 0) ||
              Number(deleteInvoiceTarget.amountPaid) > 0 ||
              deleteInvoiceTarget.paymentStatus === 'PAID' ||
              deleteInvoiceTarget.paymentStatus === 'PARTIALLY_PAID') ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5 text-amber-900 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-700" /> Invoice Has Recorded Payments
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    This invoice has {deleteInvoiceTarget.payments?.length || 0} recorded payment(s) totaling {formatINR(deleteInvoiceTarget.amountPaid)}. For genuine client invoices, standard accounting practices require using <span className="font-semibold">Cancel / Void</span> to preserve financial audit history.
                  </p>
                  <p className="text-[11px] text-amber-800">
                    If this is a <span className="font-semibold">manually created test invoice / duplicate</span>, you can authorize dev cleanup below to purge it and its linked test payments.
                  </p>
                </div>

                {/* Test duplicate purge toggle */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 bg-rose-50/50 cursor-pointer hover:bg-rose-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={isPurgeTestDuplicate}
                    onChange={(e) => setIsPurgeTestDuplicate(e.target.checked)}
                    className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-rose-900 text-xs block">
                      Purge test data duplicate & linked payments
                    </span>
                    <span className="text-[11px] text-rose-700 block leading-tight">
                      Permanently purges this test duplicate and deletes all {deleteInvoiceTarget.payments?.length || 0} payment record(s). Total Collected and dashboard metrics will automatically update. Genuine client data is never affected.
                    </span>
                  </div>
                </label>

                {isPurgeTestDuplicate ? (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      To confirm test duplicate purge, type <span className="font-mono font-bold text-rose-600">DELETE</span> below:
                    </label>
                    <Input
                      type="text"
                      placeholder='Type "DELETE" to confirm'
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] text-slate-600">Prefer to preserve payments in audit logs?</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const target = deleteInvoiceTarget;
                        setIsDeleteOpen(false);
                        setDeleteInvoiceTarget(null);
                        setCancelInvoiceTarget(target);
                        setCancelReasonText('');
                        setIsCancelOpen(true);
                      }}
                      className="text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                    >
                      <Ban className="w-3.5 h-3.5 mr-1 text-amber-600" /> Void Instead
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  To confirm permanent deletion, type <span className="font-mono font-bold text-rose-600">DELETE</span> below:
                </label>
                <Input
                  type="text"
                  placeholder='Type "DELETE" to confirm'
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setDeleteInvoiceTarget(null);
                  setDeleteConfirmText('');
                  setIsPurgeTestDuplicate(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={isDeleting}
                disabled={
                  deleteConfirmText.trim() !== 'DELETE' ||
                  (
                    Boolean(
                      (deleteInvoiceTarget.payments && deleteInvoiceTarget.payments.length > 0) ||
                      Number(deleteInvoiceTarget.amountPaid) > 0 ||
                      deleteInvoiceTarget.paymentStatus === 'PAID' ||
                      deleteInvoiceTarget.paymentStatus === 'PARTIALLY_PAID'
                    ) && !isPurgeTestDuplicate
                  )
                }
                onClick={handleDeleteInvoice}
                className="bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 3. Cancel / Void Invoice Modal */}
      {cancelInvoiceTarget && (
        <Modal
          isOpen={isCancelOpen}
          onClose={() => {
            setIsCancelOpen(false);
            setCancelInvoiceTarget(null);
            setCancelReasonText('');
          }}
          title={`Cancel / Void Invoice ${cancelInvoiceTarget.invoiceNumber}`}
          description="Void this invoice and exclude it from active receivables."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {/* Target Details */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Client:</span>
                <span className="font-bold text-slate-900">{cancelInvoiceTarget.client?.companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Total:</span>
                <span className="font-bold text-slate-900">{formatINR(cancelInvoiceTarget.invoiceAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-emerald-600">{formatINR(cancelInvoiceTarget.amountPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Remaining Balance:</span>
                <span className="font-bold text-rose-600">{formatINR(cancelInvoiceTarget.remainingBalance)}</span>
              </div>
            </div>

            {/* Warning if payments exist */}
            {Number(cancelInvoiceTarget.amountPaid) > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <span className="font-bold block flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Recorded Payments Retained in History
                </span>
                <p className="text-[11px] leading-relaxed">
                  This invoice has recorded payments of <span className="font-bold">{formatINR(cancelInvoiceTarget.amountPaid)}</span>. Cancelling this invoice will NOT erase payment records; they will remain in financial history. If funds must be returned or reallocated, please issue a credit note or refund separately.
                </p>
              </div>
            )}

            {/* Cancellation Reason input */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Cancellation Reason <span className="text-rose-500">*</span> (minimum 5 characters):
              </label>
              <Textarea
                placeholder="e.g. Scope revised by client, package downgraded, or billing correction requested..."
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                rows={3}
              />
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCancelOpen(false);
                  setCancelInvoiceTarget(null);
                  setCancelReasonText('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={isCancelling}
                disabled={cancelReasonText.trim().length < 5}
                onClick={handleCancelInvoice}
                className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

