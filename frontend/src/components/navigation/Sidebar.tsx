import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Briefcase,
  Box,
  Layers,
  CheckSquare,
  ClipboardList,
  FileText,
  Clock,
  Calendar,
  Video,
  MessageSquare,
  FolderClosed,
  Receipt,
  CreditCard,
  RefreshCw,
  BarChart3,
  PieChart,
  Settings,
  UserCheck,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

interface NavItem {
  label: string;
  isHeader?: boolean;
  to?: string;
  icon?: any;
  badge?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, isAdmin } = useAuth();

  const adminNavItems: NavItem[] = [
    { label: 'Overview', isHeader: true },
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/approvals', label: 'Approval Queue', icon: Clock },

    { label: 'Work & Execution', isHeader: true },
    { to: '/admin/tasks', label: 'All Tasks', icon: CheckSquare },
    { to: '/admin/my-tasks', label: 'My Assigned Tasks', icon: ClipboardList },
    { to: '/admin/daily-reports', label: 'Daily Work Reports', icon: FileText },
    { to: '/admin/calendar', label: 'Production Calendar', icon: Calendar },

    { label: 'Client Management', isHeader: true },
    { to: '/admin/clients', label: 'Clients 360°', icon: Briefcase },
    { to: '/admin/packages', label: 'Packages', icon: Box },
    { to: '/admin/services', label: 'Services Master', icon: Layers },
    { to: '/admin/meetings', label: 'Meetings & Minutes', icon: Video },
    { to: '/admin/communications', label: 'Client Comms', icon: MessageSquare },
    { to: '/admin/files', label: 'Client Documents', icon: FolderClosed },

    { label: 'Team Management', isHeader: true },
    { to: '/admin/employees', label: 'Employees', icon: Users },

    { label: 'Finance & Renewals', isHeader: true },
    { to: '/admin/invoices', label: 'Invoices', icon: Receipt },
    { to: '/admin/payments', label: 'Payment Records', icon: CreditCard },
    { to: '/admin/renewals', label: 'Renewals & Alerts', icon: RefreshCw },

    { label: 'Analytics & Audit', isHeader: true },
    { to: '/admin/reports', label: 'Business Reports', icon: BarChart3 },
    { to: '/admin/analytics', label: 'Analytics & Trends', icon: PieChart },
    { to: '/admin/settings', label: 'Audit Logs', icon: Settings },
  ];

  const employeeNavItems: NavItem[] = [
    { label: 'Workspace', isHeader: true },
    { to: '/employee/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { to: '/employee/my-clients', label: 'My Assigned Clients', icon: Briefcase },
    { to: '/employee/my-tasks', label: 'My Tasks', icon: CheckSquare },

    { label: 'Daily Reporting', isHeader: true },
    { to: '/employee/daily-report', label: 'Submit Daily Report', icon: FileText },
    { to: '/employee/my-reports', label: 'My Reports History', icon: ClipboardList },

    { label: 'Schedule & Profile', isHeader: true },
    { to: '/employee/calendar', label: 'My Calendar', icon: Calendar },
    { to: '/employee/profile', label: 'My Profile', icon: UserCheck },
  ];

  const navItems = isAdmin ? adminNavItems : employeeNavItems;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 border-r border-slate-800',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800 bg-slate-950/60">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-purple-600/30">
            V
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-wide flex items-center gap-1.5">
              VIRALSTAN <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600 text-white font-medium">CMS</span>
            </span>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight">
              {isAdmin ? 'ADMIN DASHBOARD' : 'EMPLOYEE DASHBOARD'}
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item, idx) => {
            if (item.isHeader) {
              return (
                <div
                  key={idx}
                  className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase"
                >
                  {item.label}
                </div>
              );
            }

            const Icon = item.icon!;
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                    isActive
                      ? 'bg-purple-600 text-white font-semibold shadow-sm shadow-purple-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Card Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-slate-800/60">
            <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold flex items-center justify-center text-xs">
              {user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.designation || user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
