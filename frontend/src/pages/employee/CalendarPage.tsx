import React, { useState, useEffect } from 'react';
import { taskService, meetingAndCommsService } from '../../services';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { Calendar as CalendarIcon, CheckSquare, Video } from 'lucide-react';

export const EmployeeCalendarPage: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSchedule = async () => {
      setIsLoading(true);
      try {
        const [taskRes, meetingRes] = await Promise.all([
          taskService.getMyTasks({ pageSize: 50 }),
          meetingAndCommsService.listMeetings(),
        ]);
        setTasks(taskRes.data || []);
        setMeetings(meetingRes || []);
      } finally {
        setIsLoading(false);
      }
    };
    loadSchedule();
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading your schedule..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Work & Meeting Calendar"
        description="Upcoming task delivery deadlines and scheduled client calls."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
            <CheckSquare className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Task Deadlines</h3>
          </div>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No task deadlines.</p>
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <p className="font-bold text-slate-900">{t.title}</p>
                  <p className="text-[11px] text-purple-700 font-medium mt-0.5">{t.client?.companyName}</p>
                  <p className="text-[10px] text-slate-600 font-semibold mt-1">Due {formatDate(t.dueDate)}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
            <Video className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Scheduled Client Calls</h3>
          </div>
          <div className="space-y-3">
            {meetings.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No meetings scheduled.</p>
            ) : (
              meetings.map((m) => (
                <div key={m.id} className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                  <p className="font-bold text-slate-900">{m.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{m.client?.companyName}</p>
                  <p className="text-[10px] text-blue-700 font-semibold mt-1">
                    {formatDateTime(m.meetingDateTime)}
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

