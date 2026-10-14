import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarEvent } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatDate, formatDateTime, formatINR } from '../../utils/formatters';
import {
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  Users,
  Video,
  Film,
  CheckSquare,
  AlertTriangle,
  ExternalLink,
  Copy,
  FileText,
  Share2,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface EventDetailModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  isAdmin = false,
}) => {
  const navigate = useNavigate();

  if (!event) return null;

  const handleCopyLink = () => {
    if (event.meetingLink) {
      navigator.clipboard.writeText(event.meetingLink);
      toast.success('Meeting link copied to clipboard');
    }
  };

  const handleOpenSource = () => {
    if (event.sourceUrl) {
      navigate(event.sourceUrl);
      onClose();
    }
  };

  const getTypeIcon = () => {
    switch (event.type) {
      case 'TASK':
        return <CheckSquare className="w-5 h-5 text-emerald-600" />;
      case 'CONTENT':
        return <Film className="w-5 h-5 text-purple-600" />;
      case 'MEETING':
        return <Video className="w-5 h-5 text-blue-600" />;
      case 'RENEWAL':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    }
  };

  const getTypeLabel = () => {
    switch (event.type) {
      case 'TASK':
        return 'Task Deadline';
      case 'CONTENT':
        return 'Social & Content Schedule';
      case 'MEETING':
        return 'Client Call / Meeting';
      case 'RENEWAL':
        return 'Contract Renewal';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${event.color.bg} ${event.color.border} border`}>
            {getTypeIcon()}
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {getTypeLabel()}
            </span>
            <h2 className="text-lg font-bold text-slate-900 leading-snug line-clamp-1">
              {event.title}
            </h2>
          </div>
        </div>
      }
      maxWidth="lg"
    >
      <div className="space-y-5 pt-1">
        {/* Badges bar */}
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${event.color.badge}`}>
            {event.type}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            Status: {event.status}
          </span>
          {event.priority && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                event.priority === 'URGENT'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : event.priority === 'HIGH'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Priority: {event.priority}
            </span>
          )}
          {event.platform && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
              {event.platform}
            </span>
          )}
          {event.contentType && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              {event.contentType}
            </span>
          )}
        </div>

        {/* Date & Time Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-start gap-3">
            <CalendarIcon className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-500 font-medium">Date & Schedule</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {event.isAllDay ? formatDate(event.start) : formatDateTime(event.start)}
              </p>
              {!event.isAllDay && event.end && event.start !== event.end && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Ends: {formatDateTime(event.end, 'hh:mm a')}
                </p>
              )}
            </div>
          </div>

          {event.clientName && (
            <div className="flex items-start gap-3">
              <Building className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500 font-medium">Client</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{event.clientName}</p>
                {event.clientEmail && (
                  <p className="text-xs text-slate-500 truncate">{event.clientEmail}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Meeting Specifics */}
        {event.type === 'MEETING' && (
          <div className="space-y-4">
            {event.meetingLink ? (
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                      Live Meeting URL
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="h-7 text-xs gap-1 border-blue-300 text-blue-800 hover:bg-blue-100"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={event.meetingLink}
                    className="flex-1 text-xs bg-white px-3 py-1.5 rounded-lg border border-blue-200 text-slate-700 truncate select-all"
                  />
                  <a
                    href={event.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shrink-0 shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Join Call
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No direct video link provided.</p>
            )}

            {event.participants && event.participants.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Participants ({event.participants.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-800"
                    >
                      <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{p.name}</span>
                      {p.designation && (
                        <span className="text-[10px] text-slate-500">({p.designation})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Task Specifics */}
        {event.type === 'TASK' && (
          <div className="space-y-3">
            {event.meta?.serviceName && (
              <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                <span className="text-slate-500">Agreed Service:</span>
                <span className="font-semibold text-slate-800">{event.meta.serviceName}</span>
              </div>
            )}
            {event.meta?.completionPercentage !== undefined && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500 font-medium">Task Completion</span>
                  <span className="font-bold text-slate-900">{event.meta.completionPercentage}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, event.meta.completionPercentage))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Renewal Specifics */}
        {event.type === 'RENEWAL' && (
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-900">Renewal Value:</span>
              <span className="text-base font-bold text-amber-900">
                {formatINR(event.amount)}
              </span>
            </div>
            {event.meta?.contractStartDate && (
              <p className="text-xs text-amber-800">
                Contract Period: {formatDate(event.meta.contractStartDate)} –{' '}
                {formatDate(event.meta.contractEndDate)}
              </p>
            )}
          </div>
        )}

        {/* Assignee / Responsible Person */}
        {event.assignedToName && (
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                {event.assignedToName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  {event.type === 'CONTENT'
                    ? 'Content Creator'
                    : event.type === 'MEETING'
                    ? 'Host / Scheduled By'
                    : 'Assigned Specialist'}
                </p>
                <p className="text-sm font-semibold text-slate-900">{event.assignedToName}</p>
              </div>
            </div>
            {event.assignedToEmail && (
              <span className="text-xs text-slate-500 hidden sm:inline">{event.assignedToEmail}</span>
            )}
          </div>
        )}

        {/* Description / Notes / Agenda */}
        {event.description && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Details & Notes</span>
            </p>
            <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {event.description}
            </div>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>

          {event.sourceUrl && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenSource}
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Original Record
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
