import { api } from './api';
import {
  User,
  AdminCount,
  Client,
  Package,
  ServiceItem,
  Task,
  DailyReport,
  ContentItem,
  Meeting,
  CommunicationLog,
  ClientFile,
  Invoice,
  Payment,
  Renewal,
  NotificationItem,
  AuditLogItem,
} from '../types';

export const authService = {
  login: async (credentials: any) => {
    const res = await api.post('/auth/login', credentials);
    return res.data.data;
  },
  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data.data;
  },
  updateProfile: async (data: any): Promise<User> => {
    const res = await api.patch('/auth/profile', data);
    return res.data.data;
  },
};

export const userService = {
  getAdminCount: async (): Promise<AdminCount> => {
    const res = await api.get('/users/admins/count');
    return res.data.data;
  },
  listAdmins: async (params?: any) => {
    const res = await api.get('/users/admins', { params });
    return res.data;
  },
  listEmployees: async (params?: any) => {
    const res = await api.get('/users/employees', { params });
    return res.data;
  },
  listUsers: async (params?: any) => {
    const res = await api.get('/users', { params });
    return res.data;
  },
  getUserById: async (id: string): Promise<User> => {
    const res = await api.get(`/users/${id}`);
    return res.data.data;
  },
  createAdmin: async (data: any): Promise<User> => {
    const res = await api.post('/users/admins', data);
    return res.data.data;
  },
  createEmployee: async (data: any): Promise<User> => {
    const res = await api.post('/users/employees', data);
    return res.data.data;
  },
  updateUser: async (id: string, data: any): Promise<User> => {
    const res = await api.patch(`/users/${id}`, data);
    return res.data.data;
  },
  updateStatus: async (id: string, status: 'ACTIVE' | 'DISABLED', reason?: string): Promise<User> => {
    const res = await api.patch(`/users/${id}/status`, { status, reason });
    return res.data.data;
  },
};

export const clientService = {
  listClients: async (params?: any) => {
    const res = await api.get('/clients', { params });
    return res.data;
  },
  getMyClients: async (params?: any) => {
    const res = await api.get('/clients/my', { params });
    return res.data;
  },
  getClientById: async (id: string): Promise<Client> => {
    const res = await api.get(`/clients/${id}`);
    return res.data.data;
  },
  createClient: async (data: any): Promise<Client> => {
    const res = await api.post('/clients', data);
    return res.data.data;
  },
  updateClient: async (id: string, data: any): Promise<Client> => {
    const res = await api.patch(`/clients/${id}`, data);
    return res.data.data;
  },
  updateClientServiceTeam: async (clientId: string, clientServiceId: string, employeeIds: string[]) => {
    const res = await api.put(`/clients/${clientId}/services/${clientServiceId}/team`, {
      employeeIds,
    });
    return res.data.data;
  },
  archiveClient: async (id: string) => {
    const res = await api.delete(`/clients/${id}`);
    return res.data;
  },
  deleteClientPermanent: async (id: string, data: { confirmation: string }) => {
    const res = await api.delete(`/clients/${id}/permanent`, { data });
    return res.data;
  },
};

export const packageService = {
  listPackages: async (): Promise<Package[]> => {
    const res = await api.get('/packages');
    return res.data.data;
  },
  getPackageById: async (id: string): Promise<Package> => {
    const res = await api.get(`/packages/${id}`);
    return res.data.data;
  },
  createPackage: async (data: any): Promise<Package> => {
    const res = await api.post('/packages', data);
    return res.data.data;
  },
  updatePackage: async (id: string, data: any): Promise<Package> => {
    const res = await api.patch(`/packages/${id}`, data);
    return res.data.data;
  },
  deletePackage: async (id: string) => {
    const res = await api.delete(`/packages/${id}`);
    return res.data;
  },
  archivePackage: async (id: string, isArchived: boolean = true): Promise<Package> => {
    const res = await api.patch(`/packages/${id}/archive`, { isArchived });
    return res.data.data;
  },
  listServices: async (): Promise<ServiceItem[]> => {
    const res = await api.get('/services');
    return res.data.data;
  },
  createService: async (data: any): Promise<ServiceItem> => {
    const res = await api.post('/services', data);
    return res.data.data;
  },
  updateService: async (id: string, data: any): Promise<ServiceItem> => {
    const res = await api.patch(`/services/${id}`, data);
    return res.data.data;
  },
  getServiceById: async (id: string): Promise<ServiceItem> => {
    const res = await api.get(`/services/${id}`);
    return res.data.data;
  },
  deleteService: async (id: string) => {
    const res = await api.delete(`/services/${id}`);
    return res.data;
  },
};

export const taskService = {
  listTasks: async (params?: any) => {
    const res = await api.get('/tasks', { params });
    return res.data;
  },
  getMyTasks: async (params?: any) => {
    const res = await api.get('/tasks/my', { params });
    return res.data;
  },
  getTaskById: async (id: string): Promise<Task> => {
    const res = await api.get(`/tasks/${id}`);
    return res.data.data;
  },
  createTask: async (data: any): Promise<Task> => {
    const res = await api.post('/tasks', data);
    return res.data.data;
  },
  updateTask: async (id: string, data: any): Promise<Task> => {
    const res = await api.patch(`/tasks/${id}`, data);
    return res.data.data;
  },
  deleteTask: async (id: string, data?: { confirmation?: string }): Promise<any> => {
    const res = await api.delete(`/tasks/${id}`, { data });
    return res.data;
  },
  startTask: async (id: string): Promise<Task> => {
    const res = await api.post(`/tasks/${id}/start`);
    return res.data.data;
  },
  updateTaskStatus: async (id: string, data: any): Promise<Task> => {
    const res = await api.patch(`/tasks/${id}/status`, data);
    return res.data.data;
  },
  approveTaskDeliverables: async (
    id: string,
    data: {
      approvedQuantity?: number;
      feedback?: string;
      deliverableId?: string;
      allowOverCredit?: boolean;
    }
  ): Promise<Task> => {
    const res = await api.post(`/tasks/${id}/approve-deliverable`, data);
    return res.data.data;
  },
  rejectTask: async (id: string, data: { feedback: string }): Promise<Task> => {
    const res = await api.post(`/tasks/${id}/reject`, data);
    return res.data.data;
  },
  getTaskDeliverableReview: async (id: string): Promise<any> => {
    const res = await api.get(`/tasks/${id}/deliverable-review`);
    return res.data.data;
  },

  addComment: async (id: string, content: string, isInternal = false) => {
    const res = await api.post(`/tasks/${id}/comments`, { content, isInternal });
    return res.data.data;
  },
  addAttachment: async (id: string, formData: FormData) => {
    const res = await api.post(`/tasks/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  getAttachments: async (id: string) => {
    const res = await api.get(`/tasks/${id}/attachments`);
    return res.data.data;
  },
  viewAttachment: async (taskId: string, attachmentId: string, fileName: string, fileType?: string) => {
    const res = await api.get(`/tasks/${taskId}/attachments/${attachmentId}/view`, {
      responseType: 'blob',
    });
    const headerType = res.headers['content-type'];
    const mimeType: string =
      fileType || (typeof headerType === 'string' ? headerType : 'application/octet-stream');
    const blob = new Blob([res.data], { type: mimeType });
    const blobUrl = window.URL.createObjectURL(blob);
    const newWin = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!newWin) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
  },
  downloadAttachment: async (taskId: string, attachmentId: string, fileName: string, fileType?: string) => {
    const res = await api.get(`/tasks/${taskId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    const headerType = res.headers['content-type'];
    const mimeType: string =
      fileType || (typeof headerType === 'string' ? headerType : 'application/octet-stream');
    const blob = new Blob([res.data], { type: mimeType });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
  },
};

export const dailyReportService = {
  listReports: async (params?: any) => {
    const res = await api.get('/reports/daily', { params });
    return res.data;
  },
  getMyReports: async (params?: any) => {
    const res = await api.get('/reports/my', { params });
    return res.data;
  },
  getReportById: async (id: string): Promise<DailyReport> => {
    const res = await api.get(`/reports/daily/${id}`);
    return res.data.data;
  },
  createReport: async (data: any): Promise<DailyReport> => {
    const res = await api.post('/reports/daily', data);
    return res.data.data;
  },
  updateReport: async (id: string, data: any): Promise<DailyReport> => {
    const res = await api.patch(`/reports/daily/${id}`, data);
    return res.data.data;
  },
  submitDraft: async (id: string): Promise<DailyReport> => {
    const res = await api.post(`/reports/daily/${id}/submit`);
    return res.data.data;
  },
  uploadAttachment: async (reportId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/reports/daily/${reportId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};

export const clientReportService = dailyReportService;

export const contentAndApprovalService = {
  listContent: async (params?: any) => {
    const res = await api.get('/content', { params });
    return res.data;
  },
  getContentById: async (id: string): Promise<ContentItem> => {
    const res = await api.get(`/content/${id}`);
    return res.data.data;
  },
  createContent: async (data: any): Promise<ContentItem> => {
    const res = await api.post('/content', data);
    return res.data.data;
  },
  updateContent: async (id: string, data: any): Promise<ContentItem> => {
    const res = await api.patch(`/content/${id}`, data);
    return res.data.data;
  },
  getPendingApprovals: async (params?: any) => {
    const res = await api.get('/approvals', { params });
    return res.data.data;
  },
};

export const meetingAndCommsService = {
  listMeetings: async (params?: any): Promise<Meeting[]> => {
    const res = await api.get('/meetings', { params });
    return res.data.data;
  },
  createMeeting: async (data: any): Promise<Meeting> => {
    const res = await api.post('/meetings', data);
    return res.data.data;
  },
  listCommunications: async (params?: any): Promise<CommunicationLog[]> => {
    const res = await api.get('/communications', { params });
    return res.data.data;
  },
  createCommunication: async (data: any): Promise<CommunicationLog> => {
    const res = await api.post('/communications', data);
    return res.data.data;
  },
  listFiles: async (params?: any): Promise<ClientFile[]> => {
    const res = await api.get('/files', { params });
    return res.data.data;
  },
  uploadFile: async (formData: FormData): Promise<ClientFile> => {
    const res = await api.post('/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};

export const financeService = {
  getSummary: async (params?: any) => {
    const res = await api.get('/summary', { params });
    return res.data.data;
  },
  getFinanceSummary: async (params?: any) => {
    const res = await api.get('/summary', { params });
    return res.data.data;
  },
  listInvoices: async (params?: any) => {
    const res = await api.get('/invoices', { params });
    return res.data;
  },
  getInvoiceById: async (id: string): Promise<Invoice> => {
    const res = await api.get(`/invoices/${id}`);
    return res.data.data;
  },
  createInvoice: async (data: any): Promise<Invoice> => {
    const res = await api.post('/invoices', data);
    return res.data.data;
  },
  downloadInvoicePdf: async (id: string, filename?: string) => {
    const res = await api.get(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `Viralstan_Invoice_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },
  printInvoicePdf: async (id: string) => {
    const res = await api.get(`/invoices/${id}/pdf?inline=true`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.open(url, '_blank');
      }
      setTimeout(() => {
        iframe.remove();
        window.URL.revokeObjectURL(url);
      }, 60000);
    };
  },
  deleteInvoice: async (
    id: string,
    data: { confirmation: string; cleanTestPayments?: boolean; reason?: string }
  ) => {
    const res = await api.delete(`/invoices/${id}`, { data });
    return res.data;
  },
  cancelInvoice: async (id: string, data: { cancelReason: string }) => {
    const res = await api.post(`/invoices/${id}/cancel`, data);
    return res.data;
  },
  recordPayment: async (data: any) => {
    const res = await api.post('/payments', data);
    return res.data.data;
  },
  listPayments: async (params?: any) => {
    const res = await api.get('/payments', { params });
    return res.data;
  },
  voidPayment: async (paymentId: string, data: { voidReason: string }) => {
    const res = await api.post(`/payments/${paymentId}/void`, data);
    return res.data.data;
  },
  listRenewals: async (params?: any): Promise<Renewal[]> => {
    const res = await api.get('/renewals', { params });
    return res.data.data;
  },
  updateRenewal: async (id: string, data: any): Promise<Renewal> => {
    const res = await api.patch(`/renewals/${id}`, data);
    return res.data.data;
  },
};

export const dashboardService = {
  getAdminDashboard: async (params?: any) => {
    const res = await api.get('/dashboard/admin', { params });
    return res.data.data;
  },
  getEmployeeDashboard: async () => {
    const res = await api.get('/dashboard/employee');
    return res.data.data;
  },
  getAnalyticsInsights: async () => {
    const res = await api.get('/dashboard/analytics');
    return res.data.data;
  },
};

export const reportService = {
  getClientDelivery: async (params?: any) => {
    const res = await api.get('/analytics/client-delivery', { params });
    return res.data.data;
  },
  getEmployeeWork: async (params?: any) => {
    const res = await api.get('/analytics/employee-work', { params });
    return res.data.data;
  },
  getEmployeeProductivity: async (params?: any) => {
    const res = await api.get('/analytics/employee-productivity', { params });
    return res.data.data;
  },
  getServicePerformance: async (params?: any) => {
    const res = await api.get('/analytics/service-performance', { params });
    return res.data.data;
  },
  getTasksReport: async (filter = 'all', params?: any) => {
    const res = await api.get('/analytics/tasks', { params: { filter, ...params } });
    return res.data.data;
  },
  getRevenueReport: async (params?: any) => {
    const res = await api.get('/analytics/revenue', { params });
    return res.data.data;
  },
  getRenewalsReport: async (params?: any) => {
    const res = await api.get('/analytics/renewals', { params });
    return res.data.data;
  },
  getExportExcelUrl: (reportType: string, params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([_, v]) => v != null && v !== '') as [string, string][]).toString() : '';
    return `/api/v1/analytics/export/excel/${reportType}${qs}`;
  },
  getExportPDFUrl: (reportType: string, params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([_, v]) => v != null && v !== '') as [string, string][]).toString() : '';
    return `/api/v1/analytics/export/pdf/${reportType}${qs}`;
  },
};

export const notificationService = {
  listNotifications: async (): Promise<{ notifications: NotificationItem[]; unreadCount: number }> => {
    const res = await api.get('/notifications');
    return res.data.data;
  },
  markAsRead: async (id: string) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },
  markAllAsRead: async () => {
    const res = await api.post('/notifications/read-all');
    return res.data;
  },
};

export const auditService = {
  listLogs: async (params?: any) => {
    const res = await api.get('/audit-logs', { params });
    return res.data;
  },
};

