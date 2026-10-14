export type Role = 'ADMIN' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export type ClientStatus =
  | 'LEAD'
  | 'WON'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'RENEWAL_DUE'
  | 'RENEWED'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CHURNED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'INTERNAL_REVIEW'
  | 'CLIENT_APPROVAL'
  | 'REVISION_REQUIRED'
  | 'APPROVED'
  | 'DELIVERED'
  | 'COMPLETED';

export type ReportStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REVISION_REQUESTED';

export type PaymentStatus = 'NOT_DUE' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'VOID';
export type RenewalStatus = 'UPCOMING' | 'DUE' | 'RENEWED' | 'CHURNED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone?: string | null;
  employeeId?: string | null;
  department?: string | null;
  designation?: string | null;
  joiningDate?: string | null;
  status: UserStatus;
  avatarUrl?: string | null;
  createdAt: string;
  _count?: {
    tasksAssigned?: number;
    clientAssignments?: number;
    dailyReportsSubmitted?: number;
  };
}

export interface AdminCount {
  total: number;
  active: number;
  max: number;
  remaining: number;
  isLimitReached: boolean;
}

export interface ClientServiceTeamMember {
  id: string;
  clientServiceId: string;
  employeeId: string;
  assignedAt?: string;
  isActive?: boolean;
  employee: {
    id: string;
    fullName: string;
    email?: string;
    designation?: string | null;
    department?: string | null;
    status?: UserStatus;
  };
}

export interface ClientServiceAssignment {
  id: string;
  clientId: string;
  serviceId: string;
  service: {
    id: string;
    name: string;
  };
  assignedEmployeeId?: string | null;
  assignedEmployee?: {
    id: string;
    fullName: string;
    email?: string;
    designation?: string;
    department?: string;
  } | null;
  assignedEmployees?: ClientServiceTeamMember[];
  monthlyTarget: number;
  completedDeliverables: number;
  serviceWeight: number;
  status: string;
  notes?: string | null;
  deliverables?: string | null;
  deliverablesConfig?: any;
}

export interface Client {
  id: string;
  companyName: string;
  contactPerson: string;
  contactDesignation?: string | null;
  mobileNumber: string;
  whatsAppNumber?: string | null;
  email: string;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedIn?: string | null;
  address?: string | null;
  city?: string | null;
  industry?: string | null;
  leadSource?: string | null;
  onboardingDate: string;
  contractStartDate: string;
  contractEndDate: string;
  renewalDate: string;
  assignedAdminId?: string | null;
  assignedAdmin?: { id: string; fullName: string; email: string } | null;
  packageId?: string | null;
  package?: { id: string; name: string; basePrice: number } | null;
  packagePricing: number;
  billingCycle: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ANNUALLY';
  clientPriority: Priority;
  clientGoals?: string | null;
  status: ClientStatus;
  contractSnapshot?: any;
  isArchived: boolean;
  deliveryProgress?: number;
  hasPendingPayments?: boolean;
  services?: ClientServiceAssignment[];
  assignedEmployees?: { user: User; primaryRole?: string }[];
  createdAt: string;
}

export type PackageType = 'SINGLE_SERVICE' | 'COMBINED_BUSINESS';
export type DeliverableType = 'QUANTITY' | 'FEATURE' | 'MILESTONE';
export type DeliverablePeriod =
  | 'ONE_TIME'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'
  | 'CAMPAIGN_SCOPE'
  | 'MILESTONE_BASED';

export interface PackageDeliverable {
  id?: string;
  name: string;
  deliverableType?: DeliverableType;
  quantity?: number | null;
  unit?: string | null;
  targetPeriod?: DeliverablePeriod;
  isIncluded?: boolean;
  description?: string | null;
  sortOrder?: number;
}

export interface PackageServiceRelation {
  id?: string;
  serviceId: string;
  service: ServiceItem;
  monthlyTarget?: number;
  defaultWeight?: number;
  deliverables?: string | null;
  deliverablesList?: PackageDeliverable[];
}

export interface Package {
  id: string;
  name: string;
  packageType: PackageType;
  description?: string | null;
  basePrice: number;
  setupFee?: number;
  billingCycle: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ANNUALLY';
  features?: string[] | null;
  isActive: boolean;
  isArchived: boolean;
  packageServices?: PackageServiceRelation[];
  _count?: { clients: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description?: string | null;
  defaultMonthlyTarget?: number;
  icon?: string | null;
  isActive: boolean;
  _count?: { clientServices: number; tasks: number; packageServices?: number };
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  clientId: string;
  client: { id: string; companyName: string };
  serviceId?: string | null;
  service?: { id: string; name: string } | null;
  assignedToId: string;
  assignedTo: { id: string; fullName: string; role: Role; designation?: string };
  assignedById: string;
  assignedBy?: { id: string; fullName: string };
  reviewerId?: string | null;
  reviewer?: { id: string; fullName: string } | null;
  startedById?: string | null;
  startedBy?: { id: string; fullName: string; role?: Role } | null;
  priority: Priority;
  startDate?: string | null;
  startedAt?: string | null;
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
  status: TaskStatus;
  completionPercentage: number;
  deliverableCount?: number;
  deliverableId?: string | null;
  deliverableName?: string | null;
  completedAt?: string | null;
  clientApprovalRequired: boolean;
  isSelfReviewed: boolean;
  isOverdue?: boolean;
  internalNotes?: string | null;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  _count?: { comments: number; attachments: number };
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  user: { id: string; fullName: string; role: Role; avatarUrl?: string };
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy?: { id: string; fullName: string };
  createdAt: string;
}

export interface DailyReport {
  id: string;
  reportDate: string;
  submittedById: string;
  submittedBy: { id: string; fullName: string; email: string; role: Role; designation?: string };
  clientId: string;
  client: { id: string; companyName: string };
  taskId?: string | null;
  task?: { id: string; title: string } | null;
  serviceId?: string | null;
  service?: { id: string; name: string } | null;
  workDescription: string;
  workCompleted: string;
  quantity?: number | null;
  unit?: string | null;
  workPending?: string | null;
  hoursSpent: number;
  issuesOrBlockers?: string | null;
  nextAction?: string | null;
  status: ReportStatus;
  submittedAt?: string | null;
  reviewerId?: string | null;
  reviewer?: { id: string; fullName: string } | null;
  reviewerComments?: string | null;
  reviewedAt?: string | null;
  isSelfReviewed: boolean;
  history?: any[];
  attachments?: {
    id: string;
    reportId: string;
    fileName: string;
    fileUrl: string;
    fileType?: string | null;
    fileSize?: number | null;
    createdAt: string;
  }[];
  createdAt: string;
}

export type ClientWorkReport = DailyReport;

export interface ContentItem {
  id: string;
  clientId: string;
  client: { id: string; companyName: string };
  title: string;
  platform: string;
  contentType: string;
  assignedEmployeeId?: string | null;
  assignedEmployee?: { id: string; fullName: string } | null;
  stage: string;
  shootDate?: string | null;
  editingDate?: string | null;
  approvalDate?: string | null;
  publishingDate?: string | null;
  caption?: string | null;
  script?: string | null;
  attachmentUrl?: string | null;
  notes?: string | null;
}

export interface Meeting {
  id: string;
  clientId: string;
  client: { id: string; companyName: string };
  title: string;
  meetingDateTime: string;
  meetingLink?: string | null;
  agenda?: string | null;
  notes?: string | null;
  actionItems?: string | null;
  followUpDate?: string | null;
  createdBy: { id: string; fullName: string };
  participants?: { user: { id: string; fullName: string; designation?: string } }[];
}

export interface CommunicationLog {
  id: string;
  clientId: string;
  client: { id: string; companyName: string };
  loggedBy: { id: string; fullName: string };
  type: string;
  date: string;
  summary: string;
  clientRequirements?: string | null;
  nextAction?: string | null;
  followUpDate?: string | null;
}

export interface ClientFile {
  id: string;
  clientId: string;
  client: { id: string; companyName: string };
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  folder: string;
  tags?: string | null;
  uploadedBy: { id: string; fullName: string };
  createdAt: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  client: { id: string; companyName: string; contactPerson: string; email: string };
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  packageValue: number;
  invoiceAmount: number;
  amountPaid: number;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  isCancelled?: boolean;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference?: string | null;
  receivedBy?: { id: string; fullName: string };
  notes?: string | null;
}

export interface Renewal {
  id: string;
  clientId: string;
  client: {
    id: string;
    companyName: string;
    contactPerson: string;
    email: string;
    mobileNumber: string;
    package?: { name: string };
  };
  contractStartDate: string;
  contractEndDate: string;
  renewalDate: string;
  renewalAmount: number;
  renewalStatus: RenewalStatus;
  daysUntilRenewal?: number;
  isDueSoon?: boolean;
  isOverdue?: boolean;
  notes?: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeState?: string | null;
  afterState?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  actor?: { id: string; fullName: string; role: Role } | null;
}

export interface AdminDashboardKpis {
  totalClients: number;
  activeClients: number;
  totalEmployees: number;
  overdueTasks: number;
  tasksAssignedToday: number;
  tasksCompleted: number;
  pendingTasks: number;
  pendingReportApprovals: number;
  totalReceivedMoney: number;
  allTimeReceivedMoney: number;
  receivedPaymentsCount?: number;
  allTimePaymentsCount?: number;
  receivedMoneyBreakdown?: {
    oneTimeProjectsReceived: number;
    recurringServicesReceived: number;
    refundsDeducted: number;
    allTimeOneTimeProjectsReceived?: number;
    allTimeRecurringServicesReceived?: number;
    allTimeRefundsDeducted?: number;
  };
  filterApplied?: {
    preset?: string;
    startDate?: string;
    endDate?: string;
  };
  monthlyRevenue?: number;
  monthlyRecurringRevenue?: number;
  mrr?: number;
  oneTimeProjectContractValue?: number;
  monthlyOneTimeRevenue?: number;
  totalMonthlyRevenue?: number;
  paymentsPending?: number;
  upcomingRenewals?: number;
}

export interface FinanceSummary {
  totalReceivedMoney: number;
  totalCollected: number;
  allTimeReceivedMoney: number;
  receivedPaymentsCount?: number;
  allTimePaymentsCount?: number;
  receivedMoneyBreakdown?: any;
  filterApplied?: any;
  monthlyInvoicedRevenue: number;
  monthlyRecurringRevenue: number;
  mrr: number;
  oneTimeProjectContractValue: number;
  monthlyOneTimeRevenue: number;
  totalInvoiced: number;
  pendingPaymentsBalance: number;
  overduePaymentsBalance: number;
  recentPayments?: any[];
}


