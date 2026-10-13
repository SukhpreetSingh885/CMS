import React, { useState, useEffect } from 'react';
import { contentAndApprovalService, taskService, meetingAndCommsService } from '../../services';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate } from '../../utils/formatters';
import { Calendar as CalendarIcon, Film, CheckSquare, Video } from 'lucide-react';

export const CalendarPage: React.FC = () => {
  const [contentItems, setContentItems] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSchedule = async () => {
      setIsLoading(true);
      try {
        const [contentRes, taskRes, meetingRes] = await Promise.all([
          contentAndApprovalService.listContent({ pageSize: 50 }),
          taskService.listTasks({ pageSize: 50 }),
          meetingAndCommsService.listMeetings(),
        ]);
        setContentItems(contentRes.data || []);
        setTasks(taskRes.data || []);
        setMeetings(meetingRes || []);
      } finally {
        setIsLoading(false);
      }
    };
    loadSchedule();
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading work calendar..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Production & Publishing Calendar"
        description="Unified schedule for scheduled social media posts, creative shoot dates, task deadlines, and client meetings."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Content Publishing Schedule */}
        <Card className="p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
            <Film className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Scheduled Social Content</h3>
          </div>
          <div className="space-y-3">
            {contentItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No content scheduled.</p>
            ) : (
              contentItems.map((c: any) => (
                <div key={c.id} className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span className="truncate">{c.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-200 text-purple-800 shrink-0">
                      {c.platform}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{c.client?.companyName}</p>
                  <p className="text-[10px] text-purple-700 font-semibold mt-2">
                    Publishing: {formatDate(c.publishingDate)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Task Deadlines */}
        <Card className="p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
            <CheckSquare className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Upcoming Task Deadlines</h3>
          </div>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No task deadlines.</p>
            ) : (
              tasks.slice(0, 8).map((t: any) => (
                <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <p className="font-bold text-slate-900 truncate">{t.title}</p>
                  <p className="text-[11px] text-slate-500">{t.client?.companyName} • {t.assignedTo?.fullName}</p>
                  <p className="text-[10px] text-slate-600 font-semibold mt-1">Due: {formatDate(t.dueDate)}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Client Meetings */}
        <Card className="p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
            <Video className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Scheduled Client Calls</h3>
          </div>
          <div className="space-y-3">
            {meetings.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No meetings scheduled.</p>
            ) : (
              meetings.map((m: any) => (
                <div key={m.id} className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                  <p className="font-bold text-slate-900">{m.title}</p>
                  <p className="text-[11px] text-slate-500">{m.client?.companyName}</p>
                  <p className="text-[10px] text-blue-700 font-semibold mt-1">
                    {formatDate(m.meetingDateTime, 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

