import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/common/LoadingState';

export const AuthLayout: React.FC = () => {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return <LoadingState message="Checking authentication..." />;
  }

  if (user) {
    return <Navigate to={isAdmin ? '/admin/dashboard' : '/employee/dashboard'} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-purple-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-bold text-2xl shadow-lg shadow-purple-600/30 mb-4">
          V
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          VIRALSTAN <span className="text-purple-400">CMS</span>
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Client & Employee Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl border border-slate-100 sm:px-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

