import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../components/navigation/Sidebar';
import { Navbar } from '../components/navigation/Navbar';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/common/LoadingState';

export const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return <LoadingState message="Loading workspace..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

