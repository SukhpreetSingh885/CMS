import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  FileText,
  CheckCircle2,
  DollarSign,
  Users,
  Clock,
} from 'lucide-react';
import { notificationService } from '../../services';
import { NotificationItem } from '../../types';
import { formatDateTime } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

function formatRelativeTime(dateString: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return 'Yesterday';
    return formatDateTime(dateString);
  } catch {
    return dateString;
  }
}

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      const data = await notificationService.listNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000); // 15s poll
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      loadNotifications();
    }
  };

  const handleMarkAsReadOnly = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Non-blocking
    }
  };

  const handleClickNotification = async (n: NotificationItem) => {
    if (!n.isRead) {
      await notificationService.markAsRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setIsOpen(false);
    if (n.link) {
      navigate(n.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Non-blocking
    }
  };

  const renderTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'REPORT':
        return <FileText className="w-3.5 h-3.5 text-emerald-600" />;
      case 'TASK':
        return <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />;
      case 'FINANCE':
        return <DollarSign className="w-3.5 h-3.5 text-amber-600" />;
      case 'CLIENT':
        return <Users className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-purple-600" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1 hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-700">No notifications yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">We'll alert you when work reports or tasks are updated.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`p-3.5 hover:bg-slate-50/90 cursor-pointer transition-colors relative group ${
                      !n.isRead ? 'bg-purple-50/50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 p-1 rounded-md bg-slate-100 shrink-0">
                        {renderTypeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <h4
                            className={`text-xs leading-snug line-clamp-1 ${
                              !n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                            }`}
                          >
                            {n.title}
                          </h4>
                          {!n.isRead ? (
                            <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0 mt-1" />
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                          {n.message}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/60">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatRelativeTime(n.createdAt)}
                          </span>
                          <div className="flex items-center gap-2">
                            {!n.isRead && (
                              <button
                                onClick={(e) => handleMarkAsReadOnly(e, n.id)}
                                title="Mark as read"
                                className="text-[10px] text-slate-400 hover:text-purple-600 p-0.5 rounded hover:bg-purple-100 flex items-center gap-0.5 transition-colors"
                              >
                                <Check className="w-3 h-3" /> Read
                              </button>
                            )}
                            {n.link && (
                              <span className="text-[10px] text-purple-600 font-semibold flex items-center gap-0.5">
                                View <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

