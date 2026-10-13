import React from 'react';
import { getStatusBadgeStyle } from '../../utils/formatters';
import { cn } from '../../utils/cn';

export const StatusBadge: React.FC<{ status: string; label?: string; className?: string }> = ({
  status,
  label,
  className,
}) => {
  const upper = status?.toUpperCase() || '';
  const defaultLabel =
    upper === 'ASSIGNED' || upper === 'CREATED'
      ? 'Not Started'
      : status
      ? status.replace(/_/g, ' ')
      : '-';
  const formatted = label || defaultLabel;
  const badgeStyle = getStatusBadgeStyle(status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider',
        badgeStyle,
        className
      )}
    >
      {formatted}
    </span>
  );
};

