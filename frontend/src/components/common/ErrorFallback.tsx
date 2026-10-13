import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '../ui/Button';

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo?: React.ErrorInfo | null;
  resetErrorBoundary?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  const handleReload = () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Something went wrong</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          An unexpected application rendering error occurred. You can try refreshing the view or navigating back to your dashboard.
        </p>

        {error && (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 mb-6 text-left overflow-auto max-h-32 text-xs font-mono text-slate-300">
            <span className="text-red-400 font-semibold block mb-1">Error message:</span>
            {error.message || 'Unknown runtime exception'}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={handleGoHome}
            className="flex-1 flex items-center justify-center gap-2 border-slate-700 hover:bg-slate-800 text-slate-200"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Button>

          <Button
            onClick={handleReload}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
};

