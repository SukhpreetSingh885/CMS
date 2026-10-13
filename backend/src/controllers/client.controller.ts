import { Request, Response, NextFunction } from 'express';
import { ClientService } from '../services/client.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export class ClientController {
  static async listClients(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ClientService.listClients(req.query as any);
      return sendPaginated(
        res,
        result.clients,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Clients listed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getMyClients(req: Request, res: Response, next: NextFunction) {
    try {
      await ClientService.syncEmployeeClientAssignments(req.user!.id);
      const result = await ClientService.listClients({
        ...req.query,
        assignedEmployeeId: req.user!.id,
      } as any);

      const sanitizedClients = (result.clients || []).map((c: any) => ({
        ...c,
        packagePricing: undefined,
        invoices: undefined,
        contractSnapshot: undefined,
      }));

      return sendPaginated(
        res,
        sanitizedClients,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'My assigned clients'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getClientById(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await ClientService.getClientById(req.params.id, req.user);
      return sendSuccess(res, client, 'Client profile details');
    } catch (error) {
      next(error);
    }
  }

  static async createClient(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await ClientService.createClient(req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, client, 'Client onboarded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateClient(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await ClientService.updateClient(req.params.id, req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, updated, 'Client updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateClientServiceTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const updatedService = await ClientService.updateClientServiceTeam(
        req.params.id,
        req.params.clientServiceId,
        req.body.employeeIds || [],
        req.user!.id,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, updatedService, 'Service team updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async archiveClient(req: Request, res: Response, next: NextFunction) {
    try {
      const archived = await ClientService.archiveClient(req.params.id, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, archived, 'Client archived successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteClientPermanent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ClientService.deleteClientPermanent(
        req.params.id,
        req.body.confirmation,
        req.user!.id,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

