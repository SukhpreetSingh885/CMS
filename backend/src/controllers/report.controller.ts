import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service.js';
import { ExportService } from '../services/export.service.js';
import { sendSuccess } from '../utils/response.js';

export class ReportController {
  static async getClientDeliveryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getClientDeliveryReport(req.query as any);
      return sendSuccess(res, data, 'Client delivery report');
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeeWorkReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getEmployeeWorkReport(req.query as any);
      return sendSuccess(res, data, 'Employee daily work report');
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeeProductivityReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getEmployeeProductivityReport(req.query as any);
      return sendSuccess(res, data, 'Employee productivity report');
    } catch (error) {
      next(error);
    }
  }

  static async getServicePerformanceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getServicePerformanceReport(req.query as any);
      return sendSuccess(res, data, 'Service performance report');
    } catch (error) {
      next(error);
    }
  }

  static async getTasksReport(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = req.query.filter as any;
      const data = await ReportService.getTasksReport(filter, req.query as any);
      return sendSuccess(res, data, 'Tasks report');
    } catch (error) {
      next(error);
    }
  }

  static async getRevenueReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getRevenueAndPaymentReport(req.query as any);
      return sendSuccess(res, data, 'Revenue report');
    } catch (error) {
      next(error);
    }
  }

  static async getRenewalReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getRenewalReport(req.query as any);
      return sendSuccess(res, data, 'Client renewal report');
    } catch (error) {
      next(error);
    }
  }

  // Export endpoints
  static async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportType } = req.params;
      const filename = `Viralstan_${reportType}_${Date.now()}`;

      if (reportType === 'service-performance') {
        const data = await ReportService.getServicePerformanceReport(req.query as any);
        const flatData = data.map((s) => ({
          serviceName: s.serviceName,
          activeClients: s.activeClients,
          tasksCreated: s.tasksCreated,
          tasksCompleted: s.tasksCompleted,
          taskCompletionRate: `${s.taskCompletionRate}%`,
          agreedDeliverables: s.agreedDeliverables,
          targetPeriod: s.targetPeriod,
          approvedDeliverables: s.completedDeliverables,
          deliveryProgress: `${s.approvedDeliverableProgress}%`,
        }));
        await ExportService.exportToExcel(
          res,
          'Service Performance',
          [
            { header: 'Service Name', key: 'serviceName', width: 25 },
            { header: 'Active Clients', key: 'activeClients', width: 15 },
            { header: 'Tasks Created', key: 'tasksCreated', width: 15 },
            { header: 'Tasks Completed', key: 'tasksCompleted', width: 16 },
            { header: 'Task Completion %', key: 'taskCompletionRate', width: 18 },
            { header: 'Agreed Deliverables', key: 'agreedDeliverables', width: 35 },
            { header: 'Target Period', key: 'targetPeriod', width: 20 },
            { header: 'Approved Units', key: 'approvedDeliverables', width: 16 },
            { header: 'Deliverable Progress', key: 'deliveryProgress', width: 20 },
          ],
          flatData,
          filename
        );
      } else if (reportType === 'client-delivery') {
        const data = await ReportService.getClientDeliveryReport(req.query as any);
        const flatData = data.map((c) => ({
          companyName: c.companyName,
          packageName: c.packageName,
          status: c.status,
          deliveryProgress: `${c.overallDeliveryProgress}%`,
          target: c.totalDeliverablesTarget,
          completed: c.totalDeliverablesCompleted,
        }));
        await ExportService.exportToExcel(
          res,
          'Client Delivery',
          [
            { header: 'Client', key: 'companyName', width: 25 },
            { header: 'Package', key: 'packageName', width: 18 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Delivery Progress', key: 'deliveryProgress', width: 20 },
            { header: 'Deliverables Target', key: 'target', width: 20 },
            { header: 'Deliverables Done', key: 'completed', width: 20 },
          ],
          flatData,
          filename
        );
      } else if (reportType === 'employee-productivity') {
        const data = await ReportService.getEmployeeProductivityReport(req.query as any);
        await ExportService.exportToExcel(
          res,
          'Employee Productivity',
          [
            { header: 'Emp ID', key: 'employeeId', width: 15 },
            { header: 'Name', key: 'fullName', width: 25 },
            { header: 'Designation', key: 'designation', width: 20 },
            { header: 'Assigned Tasks', key: 'totalTasksAssigned', width: 16 },
            { header: 'Completed Tasks', key: 'completedTasks', width: 16 },
            { header: 'Pending Tasks', key: 'pendingTasks', width: 16 },
            { header: 'Overdue Tasks', key: 'overdueTasks', width: 16 },
            { header: 'Completion Rate %', key: 'taskCompletionRate', width: 18 },
            { header: 'Hours Logged', key: 'totalWorkHoursLogged', width: 16 },
            { header: 'Reports Approved', key: 'reportsApproved', width: 18 },
          ],
          data,
          filename
        );
      } else if (reportType === 'revenue') {
        const data = await ReportService.getRevenueAndPaymentReport(req.query as any);
        const flatData = (data.invoices || []).map((inv: any) => ({
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.clientName,
          invoiceDate: inv.invoiceDate,
          amount: inv.amount,
          amountPaid: inv.amountPaid,
          remainingBalance: inv.remainingBalance,
          status: inv.status,
        }));
        await ExportService.exportToExcel(
          res,
          'Revenue & Collections',
          [
            { header: 'Invoice #', key: 'invoiceNumber', width: 18 },
            { header: 'Client', key: 'clientName', width: 25 },
            { header: 'Invoice Date', key: 'invoiceDate', width: 15 },
            { header: 'Total Invoiced (INR)', key: 'amount', width: 20 },
            { header: 'Total Received Money (INR)', key: 'amountPaid', width: 25 },
            { header: 'Remaining Balance (INR)', key: 'remainingBalance', width: 22 },
            { header: 'Payment Status', key: 'status', width: 16 },
          ],
          flatData,
          filename
        );
      } else {
        const filter = (req.query.filter as any) || 'all';
        const data = await ReportService.getTasksReport(filter, req.query as any);
        await ExportService.exportToExcel(
          res,
          'Tasks Report',
          [
            { header: 'Task Title', key: 'title', width: 30 },
            { header: 'Client', key: 'clientName', width: 22 },
            { header: 'Assigned To', key: 'assignedTo', width: 20 },
            { header: 'Priority', key: 'priority', width: 15 },
            { header: 'Status', key: 'status', width: 18 },
            { header: 'Due Date', key: 'dueDate', width: 15 },
          ],
          data,
          filename
        );
      }
    } catch (error) {
      next(error);
    }
  }

  static async exportPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportType } = req.params;
      const filename = `Viralstan_${reportType}_${Date.now()}`;

      if (reportType === 'service-performance') {
        const data = await ReportService.getServicePerformanceReport(req.query as any);
        const headers = ['Service', 'Clients', 'Created', 'Done', 'Task %', 'Period', 'Progress %'];
        const rows = data.map((s) => [
          s.serviceName,
          s.activeClients,
          s.tasksCreated,
          s.tasksCompleted,
          `${s.taskCompletionRate}%`,
          s.targetPeriod,
          `${s.approvedDeliverableProgress}%`,
        ]);
        ExportService.exportToPDF(
          res,
          'Service Performance Report',
          'Overview of service utilization, tasks closure, and approved deliverable fulfillment',
          headers,
          rows,
          filename
        );
      } else if (reportType === 'client-delivery') {
        const data = await ReportService.getClientDeliveryReport(req.query as any);
        const headers = ['Client', 'Package', 'Status', 'Progress', 'Target', 'Done'];
        const rows = data.map((c) => [
          c.companyName,
          c.packageName,
          c.status,
          `${c.overallDeliveryProgress}%`,
          c.totalDeliverablesTarget,
          c.totalDeliverablesCompleted,
        ]);
        ExportService.exportToPDF(
          res,
          'Client Delivery Performance Report',
          'Overview of all client packages, deliverables, and service targets',
          headers,
          rows,
          filename
        );
      } else if (reportType === 'revenue') {
        const data = await ReportService.getRevenueAndPaymentReport(req.query as any);
        const headers = ['Invoice #', 'Client', 'Date', 'Invoiced', 'Received', 'Balance', 'Status'];
        const rows = (data.invoices || []).map((inv: any) => [
          inv.invoiceNumber,
          inv.clientName,
          inv.invoiceDate,
          `INR ${inv.amount}`,
          `INR ${inv.amountPaid}`,
          `INR ${inv.remainingBalance}`,
          inv.status,
        ]);
        ExportService.exportToPDF(
          res,
          'Revenue & Collections Report',
          `Total Invoiced: INR ${data.summary?.totalInvoiced || 0} | Total Received Money: INR ${data.summary?.totalReceivedMoney || data.summary?.totalCollected || 0} | Pending: INR ${data.summary?.totalPending || 0}`,
          headers,
          rows,
          filename
        );
      } else {
        const data = await ReportService.getEmployeeProductivityReport(req.query as any);
        const headers = ['Emp ID', 'Name', 'Designation', 'Assigned', 'Done', 'Pending', 'Overdue', 'Rate %', 'Hours', 'Approved'];
        const rows = data.map((e) => [
          e.employeeId,
          e.fullName,
          e.designation,
          e.totalTasksAssigned,
          e.completedTasks,
          e.pendingTasks,
          e.overdueTasks,
          `${e.taskCompletionRate}%`,
          `${e.totalWorkHoursLogged} hrs`,
          e.reportsApproved,
        ]);
        ExportService.exportToPDF(
          res,
          'Employee Productivity Summary',
          'Company-wide employee work efficiency, task closure, and logged hours',
          headers,
          rows,
          filename
        );
      }
    } catch (error) {
      next(error);
    }
  }
}

