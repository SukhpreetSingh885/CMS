import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { taskService, contentAndApprovalService, meetingAndCommsService, clientService, userService } from '../../services';
import { Client, User } from '../../types';
import { CheckSquare, Film, Video, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QuickAddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string; // YYYY-MM-DD
  initialType?: 'TASK' | 'CONTENT' | 'MEETING';
}

export const QuickAddEventModal: React.FC<QuickAddEventModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultDate,
  initialType = 'TASK',
}) => {
  const [activeTab, setActiveTab] = useState<'TASK' | 'CONTENT' | 'MEETING'>(initialType);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    clientId: '',
    assignedToId: '',
    dueDate: defaultDate ? `${defaultDate}T18:00` : '',
    priority: 'MEDIUM',
    description: '',
  });

  // Content form state
  const [contentForm, setContentForm] = useState({
    title: '',
    clientId: '',
    platform: 'INSTAGRAM',
    contentType: 'REEL',
    assignedEmployeeId: '',
    publishingDate: defaultDate ? `${defaultDate}T10:00` : '',
    caption: '',
  });

  // Meeting form state
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    clientId: '',
    meetingDateTime: defaultDate ? `${defaultDate}T14:00` : '',
    meetingLink: '',
    agenda: '',
    participantIds: [] as string[],
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
      if (defaultDate) {
        setTaskForm((prev) => ({ ...prev, dueDate: `${defaultDate}T18:00` }));
        setContentForm((prev) => ({ ...prev, publishingDate: `${defaultDate}T10:00` }));
        setMeetingForm((prev) => ({ ...prev, meetingDateTime: `${defaultDate}T14:00` }));
      }

      const loadMeta = async () => {
        setIsLoadingMetadata(true);
        try {
          const [cRes, uRes] = await Promise.all([
            clientService.listClients({ pageSize: 100 }),
            userService.listEmployees({ pageSize: 100 }),
          ]);
          setClients(cRes.data || []);
          setEmployees(uRes.data || []);
        } catch (err) {
          console.error('Failed to load clients/employees', err);
        } finally {
          setIsLoadingMetadata(false);
        }
      };
      loadMeta();
    }
  }, [isOpen, defaultDate, initialType]);

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return toast.error('Task title is required');
    if (!taskForm.clientId) return toast.error('Please select a client');
    if (!taskForm.assignedToId) return toast.error('Please assign an employee');
    if (!taskForm.dueDate) return toast.error('Due date is required');

    setIsSubmitting(true);
    try {
      await taskService.createTask({
        title: taskForm.title.trim(),
        clientId: taskForm.clientId,
        assignedToId: taskForm.assignedToId,
        dueDate: new Date(taskForm.dueDate).toISOString(),
        priority: taskForm.priority as any,
        description: taskForm.description.trim() || undefined,
      });
      toast.success('Task created successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentForm.title.trim()) return toast.error('Content title is required');
    if (!contentForm.clientId) return toast.error('Please select a client');

    setIsSubmitting(true);
    try {
      await contentAndApprovalService.createContent({
        title: contentForm.title.trim(),
        clientId: contentForm.clientId,
        platform: contentForm.platform as any,
        contentType: contentForm.contentType as any,
        assignedEmployeeId: contentForm.assignedEmployeeId || undefined,
        publishingDate: contentForm.publishingDate ? new Date(contentForm.publishingDate).toISOString() : undefined,
        caption: contentForm.caption.trim() || undefined,
      });
      toast.success('Content scheduled successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to schedule content');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingForm.title.trim()) return toast.error('Meeting title is required');
    if (!meetingForm.clientId) return toast.error('Please select a client');
    if (!meetingForm.meetingDateTime) return toast.error('Meeting date and time are required');

    setIsSubmitting(true);
    try {
      await meetingAndCommsService.createMeeting({
        title: meetingForm.title.trim(),
        clientId: meetingForm.clientId,
        meetingDateTime: new Date(meetingForm.meetingDateTime).toISOString(),
        meetingLink: meetingForm.meetingLink.trim() || undefined,
        agenda: meetingForm.agenda.trim() || undefined,
        participantIds: meetingForm.participantIds.length > 0 ? meetingForm.participantIds : undefined,
      });
      toast.success('Meeting scheduled successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to schedule meeting');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add Production Calendar Activity</h2>
            <p className="text-xs text-slate-500">Quickly create a task, scheduled post, or client meeting</p>
          </div>
        </div>
      }
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Tab switchers */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('TASK')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'TASK'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            Task Deadline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CONTENT')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'CONTENT'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Film className="w-4 h-4 text-purple-600" />
            Social Content
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MEETING')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'MEETING'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className="w-4 h-4 text-blue-600" />
            Client Meeting
          </button>
        </div>

        {/* Tab 1: Task Form */}
        {activeTab === 'TASK' && (
          <form onSubmit={handleSubmitTask} className="space-y-4">
            <Input
              label="Task Title"
              placeholder="e.g. Website wireframes design or SEO audit"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Client <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  value={taskForm.clientId}
                  onChange={(e) => setTaskForm({ ...taskForm, clientId: e.target.value })}
                  required
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  value={taskForm.assignedToId}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}
                  required
                >
                  <option value="">Select employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Due Date & Time"
                type="datetime-local"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <Textarea
              label="Task Details (Optional)"
              placeholder="Provide delivery requirements or guidelines..."
              rows={3}
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Content Form */}
        {activeTab === 'CONTENT' && (
          <form onSubmit={handleSubmitContent} className="space-y-4">
            <Input
              label="Content Title / Brief"
              placeholder="e.g. October Product Launch Reel or Festival Carousel"
              value={contentForm.title}
              onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Client <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  value={contentForm.clientId}
                  onChange={(e) => setContentForm({ ...contentForm, clientId: e.target.value })}
                  required
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Creator / Specialist (Optional)
                </label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  value={contentForm.assignedEmployeeId}
                  onChange={(e) => setContentForm({ ...contentForm, assignedEmployeeId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.designation || 'Creator'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Platform</label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  value={contentForm.platform}
                  onChange={(e) => setContentForm({ ...contentForm, platform: e.target.value })}
                >
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="WEBSITE">Website</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Content Type</label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  value={contentForm.contentType}
                  onChange={(e) => setContentForm({ ...contentForm, contentType: e.target.value })}
                >
                  <option value="REEL">Reel / Short</option>
                  <option value="POST">Post / Graphic</option>
                  <option value="CAROUSEL">Carousel</option>
                  <option value="STORY">Story</option>
                  <option value="VIDEO">Long Video</option>
                  <option value="BANNER">Banner</option>
                  <option value="BLOG">Blog</option>
                </select>
              </div>

              <Input
                label="Publish Date & Time"
                type="datetime-local"
                value={contentForm.publishingDate}
                onChange={(e) => setContentForm({ ...contentForm, publishingDate: e.target.value })}
              />
            </div>

            <Textarea
              label="Caption / Brief"
              placeholder="Caption copy or content production notes..."
              rows={3}
              value={contentForm.caption}
              onChange={(e) => setContentForm({ ...contentForm, caption: e.target.value })}
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Schedule Content'}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 3: Meeting Form */}
        {activeTab === 'MEETING' && (
          <form onSubmit={handleSubmitMeeting} className="space-y-4">
            <Input
              label="Meeting Title"
              placeholder="e.g. Monthly Strategy Review or Performance Sync"
              value={meetingForm.title}
              onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Client <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  value={meetingForm.clientId}
                  onChange={(e) => setMeetingForm({ ...meetingForm, clientId: e.target.value })}
                  required
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Meeting Date & Time"
                type="datetime-local"
                value={meetingForm.meetingDateTime}
                onChange={(e) => setMeetingForm({ ...meetingForm, meetingDateTime: e.target.value })}
                required
              />
            </div>

            <Input
              label="Meeting URL (Google Meet / Zoom)"
              placeholder="https://meet.google.com/xyz-abcd-efg"
              value={meetingForm.meetingLink}
              onChange={(e) => setMeetingForm({ ...meetingForm, meetingLink: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Team Participants
              </label>
              <select
                multiple
                className="w-full text-xs rounded-xl border border-slate-200 p-2 bg-white h-24 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                value={meetingForm.participantIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                  setMeetingForm({ ...meetingForm, participantIds: selected });
                }}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.designation || 'Staff'})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Hold Ctrl (or Cmd on Mac) to select multiple team members.
              </p>
            </div>

            <Textarea
              label="Agenda & Discussion Topics"
              placeholder="List items to discuss..."
              rows={3}
              value={meetingForm.agenda}
              onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Schedule Meeting'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
