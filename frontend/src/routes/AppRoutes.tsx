import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import { AuthLayout } from '../layouts/AuthLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { EmployeeLayout } from '../layouts/EmployeeLayout';

// Auth Pages
import { Login } from '../pages/auth/Login';
import { ForgotPassword } from '../pages/auth/ForgotPassword';

// Admin Pages
import { AdminDashboard } from '../pages/admin/Dashboard';
import { Employees } from '../pages/admin/Employees';
import { Clients } from '../pages/admin/Clients';
import { ClientDetail } from '../pages/admin/ClientDetail';
import { Packages } from '../pages/admin/Packages';
import { Services } from '../pages/admin/Services';
import { Tasks } from '../pages/admin/Tasks';
import { MyTasks as AdminMyTasks } from '../pages/admin/MyTasks';
import { DailyReports } from '../pages/admin/DailyReports';
import { Approvals } from '../pages/admin/Approvals';
import { CalendarPage as AdminCalendar } from '../pages/admin/CalendarPage';
import { Meetings } from '../pages/admin/Meetings';
import { Communications } from '../pages/admin/Communications';
import { Files } from '../pages/admin/Files';
import { Invoices } from '../pages/admin/Invoices';
import { Payments } from '../pages/admin/Payments';
import { Renewals } from '../pages/admin/Renewals';
import { Reports } from '../pages/admin/Reports';
import { Analytics } from '../pages/admin/Analytics';
import { Settings } from '../pages/admin/Settings';

// Employee Pages
import { EmployeeDashboard } from '../pages/employee/Dashboard';
import { MyClients } from '../pages/employee/MyClients';
import { MyTasks as EmployeeMyTasks } from '../pages/employee/MyTasks';
import { DailyReportSubmit } from '../pages/employee/DailyReportSubmit';
import { MyReports } from '../pages/employee/MyReports';
import { EmployeeCalendarPage } from '../pages/employee/CalendarPage';
import { Profile } from '../pages/employee/Profile';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Admin Protected Routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="packages" element={<Packages />} />
        <Route path="services" element={<Services />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="my-tasks" element={<AdminMyTasks />} />
        <Route path="daily-reports" element={<DailyReports />} />
        <Route path="client-reports" element={<DailyReports />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="calendar" element={<AdminCalendar />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="communications" element={<Communications />} />
        <Route path="files" element={<Files />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="payments" element={<Payments />} />
        <Route path="renewals" element={<Renewals />} />
        <Route path="reports" element={<Reports />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Employee Protected Routes */}
      <Route path="/employee" element={<EmployeeLayout />}>
        <Route index element={<Navigate to="/employee/dashboard" replace />} />
        <Route path="dashboard" element={<EmployeeDashboard />} />
        <Route path="my-clients" element={<MyClients />} />
        <Route path="my-tasks" element={<EmployeeMyTasks />} />
        <Route path="daily-report" element={<DailyReportSubmit />} />
        <Route path="client-report" element={<DailyReportSubmit />} />
        <Route path="my-reports" element={<MyReports />} />
        <Route path="my-client-reports" element={<MyReports />} />
        <Route path="calendar" element={<EmployeeCalendarPage />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

