import React from 'react';
import { Menu, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';
import { Link } from 'react-router-dom';

export const Navbar: React.FC<{ onToggleSidebar: () => void }> = ({ onToggleSidebar }) => {
  const { user, logout, isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1.5">
            {isAdmin ? (
              <>
                <Shield className="w-3.5 h-3.5 text-purple-600" /> Admin Workspace
              </>
            ) : (
              <>
                <UserIcon className="w-3.5 h-3.5 text-slate-600" /> Employee Workspace
              </>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Real-time Notifications */}
        <NotificationDropdown />

        {/* User profile shortcut & Logout */}
        <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200">
          <Link
            to={isAdmin ? '/admin/settings' : '/employee/profile'}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs border border-purple-200">
              {user?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.fullName}</p>
              <p className="text-[10px] text-slate-500">{user?.email}</p>
            </div>
          </Link>

          <button
            onClick={() => logout()}
            title="Sign out"
            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

