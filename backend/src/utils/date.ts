import { format, formatDistanceToNow, isValid } from 'date-fns';

/**
 * Format date in Indian Standard Time (IST) presentation
 */
export function formatISTDate(date: Date | string | null | undefined, pattern = 'dd MMM yyyy'): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '-';
  return format(d, pattern);
}

export function formatISTDateTime(date: Date | string | null | undefined, pattern = 'dd MMM yyyy, hh:mm a'): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '-';
  return format(d, pattern);
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '-';
  return formatDistanceToNow(d, { addSuffix: true });
}

