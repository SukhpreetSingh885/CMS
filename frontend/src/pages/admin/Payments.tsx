import React, { useState, useEffect } from 'react';
import { financeService } from '../../services';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/common/LoadingState';
import { formatINR, formatDate } from '../../utils/formatters';
import { CreditCard, Search, ArrowDownLeft, FileText, CheckCircle2, Ban } from 'lucide-react';
import { DateQuickFilter, FilterToolbar, SearchInput, FilterSelect } from '../../components/filters';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import { toast } from 'sonner';

export const Payments: React.FC = () => {
  const { filters, setFilter, setFilters, clearFilter, clearAllFilters } = useSmartFilters({
    search: '',
    paymentMethod: '',
    dateRange: '',
    startDate: '',
    endDate: '',
  });

  const [summary, setSummary] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [totalPayments, setTotalPayments] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [isLoading, setIsLoading] = useState(true);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [isVoiding, setIsVoiding] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sumData, payData] = await Promise.all([
        financeService.getSummary(),
        financeService.listPayments({
          search: filters.search || undefined,
          paymentMethod: filters.paymentMethod || undefined,
          dateRange: filters.dateRange || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          page,
          pageSize,
        }),
      ]);
      setSummary(sumData);
      setPayments(payData.data || []);
      setTotalPayments(payData.pagination?.total || 0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoidPayment = async (paymentId: string) => {
    if (!voidReason.trim()) {
      toast.error('Please enter a reason for voiding/reversing this payment');
      return;
    }
    setIsVoiding(true);
    try {
      await financeService.voidPayment(paymentId, { voidReason: voidReason.trim() });
      toast.success('Payment successfully voided and ledger balance updated');
      setVoidingPaymentId(null);
      setVoidReason('');
      window.dispatchEvent(new CustomEvent('finance-data-updated'));
      loadData();
    } finally {
      setIsVoiding(false);
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
  }, [filters.search, filters.paymentMethod, filters.dateRange, filters.startDate, filters.endDate, page]);

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.paymentMethod) list.push({ key: 'paymentMethod', label: 'Method', value: filters.paymentMethod });
    if (filters.dateRange) {
      list.push({ key: 'dateRange', label: 'Timeline', value: filters.dateRange });
    } else if (filters.startDate || filters.endDate) {
      list.push({
        key: 'dateRange',
        label: 'Date Range',
        value: `${filters.startDate || ''} to ${filters.endDate || ''}`,
      });
    }
    return list;
  }, [filters]);

  const handleRemoveFilter = (key: string) => {
    if (key === 'dateRange') {
      setFilters({ dateRange: '', startDate: '', endDate: '' });
    } else {
      clearFilter(key);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Records & Transactions"
        description="Audit ledger of all incoming verified client collections, bank transfers, and receipts."
      />

      {/* Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Confirmed Total Collected</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatINR(summary?.totalCollected || 0)}</p>
          <p className="text-[11px] text-slate-400 mt-1">Calculated strictly from verified payment records</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Pending Invoiced Balance</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(summary?.pendingPaymentsBalance || 0)}</p>
          <p className="text-[11px] text-slate-400 mt-1">Outstanding receivable balance on invoices</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Overdue Balance</span>
          <p className="text-2xl font-bold text-rose-600 mt-1">{formatINR(summary?.overduePaymentsBalance || 0)}</p>
          <p className="text-[11px] text-slate-400 mt-1">Past payment due date</p>
        </div>
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
              setPage(1);
            }}
          />
        }
        totalResults={totalPayments}
        resultsLabel="payments"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearAllFilters={() => {
          clearAllFilters();
          setPage(1);
        }}
      >
        <SearchInput
          placeholder="Search UTR ref, invoice #, client..."
          value={filters.search}
          onChange={(val) => {
            setFilter('search', val);
            setPage(1);
          }}
        />
        <FilterSelect
          label="Method"
          value={filters.paymentMethod}
          onChange={(val) => {
            setFilter('paymentMethod', val);
            setPage(1);
          }}
          options={[
            { label: 'Bank Transfer (NEFT/IMPS)', value: 'BANK_TRANSFER' },
            { label: 'UPI', value: 'UPI' },
            { label: 'Credit Card', value: 'CREDIT_CARD' },
            { label: 'Cheque', value: 'CHEQUE' },
            { label: 'Cash', value: 'CASH' },
          ]}
        />
      </FilterToolbar>

      {/* Payment Ledger Table */}
      <Card className="p-0 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Verified Payment Ledger</h3>
          <span className="text-xs text-slate-500">Showing {payments.length} of {totalPayments} payments</span>
        </div>

        {isLoading ? (
          <div className="py-12">
            <LoadingState message="Loading payment transactions..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Amount Received</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Transaction / UTR Ref</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No payment records found matching the filters.
                    </td>
                  </tr>
                ) : (
                  payments.map((p: any) => (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{p.client?.companyName}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {p.invoice?.invoiceNumber || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600 text-sm whitespace-nowrap">
                          {formatINR(p.amount)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {p.transactionReference ? (
                            <span className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                              {p.transactionReference}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No reference recorded</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-semibold whitespace-nowrap">
                          {p.receivedBy?.fullName || '-'}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setVoidingPaymentId(voidingPaymentId === p.id ? null : p.id);
                              setVoidReason('');
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline inline-flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" /> Void
                          </button>
                        </td>
                      </tr>
                      {voidingPaymentId === p.id && (
                        <tr className="bg-rose-50/60">
                          <td colSpan={8} className="p-3">
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-rose-800">
                                Reason for Voiding / Reversing Payment of {formatINR(p.amount)}:
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="e.g. Duplicate transaction / cheque bounced / incorrect entry..."
                                  value={voidReason}
                                  onChange={(e) => setVoidReason(e.target.value)}
                                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-rose-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => setVoidingPaymentId(null)}
                                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isVoiding}
                                  onClick={() => handleVoidPayment(p.id)}
                                  className="px-3 py-1.5 text-xs rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
                                >
                                  {isVoiding ? 'Voiding...' : 'Confirm Void'}
                                </button>
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
        )}

        {/* Pagination */}
        {totalPayments > pageSize && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {page} of {Math.ceil(totalPayments / pageSize)}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= Math.ceil(totalPayments / pageSize)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};


