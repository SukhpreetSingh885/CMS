import React from 'react';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading data...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
      <p className="mt-3 text-xs font-medium text-slate-500">{message}</p>
    </div>
  );
};

