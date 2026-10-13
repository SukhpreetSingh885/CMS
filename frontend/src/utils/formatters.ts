import { format, isValid } from 'date-fns';

export function formatINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatDate(date: Date | string | null | undefined, pattern = 'dd MMM yyyy'): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '-';
  return format(d, pattern);
}

export function formatDateTime(date: Date | string | null | undefined, pattern = 'dd MMM yyyy, hh:mm a'): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '-';
  return format(d, pattern);
}

export function getStatusBadgeStyle(status: string): string {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'PAID':
    case 'COMPLETED':
    case 'PUBLISHED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'IN_PROGRESS':
    case 'ONBOARDING':
    case 'PARTIALLY_PAID':
    case 'SCHEDULED':
    case 'DELIVERED':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'INTERNAL_REVIEW':
    case 'CLIENT_APPROVAL':
    case 'RENEWAL_DUE':
    case 'DUE':
    case 'UPCOMING':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'REVISION_REQUIRED':
    case 'REVISION_REQUESTED':
    case 'OVERDUE':
    case 'DISABLED':
    case 'CHURNED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'DRAFT':
    case 'CREATED':
    case 'ASSIGNED':
    case 'NOT_DUE':
    case 'PAUSED':
    case 'LEAD':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

