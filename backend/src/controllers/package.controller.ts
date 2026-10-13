import { Request, Response, NextFunction } from 'express';
import { PackageService, ServiceItemService } from '../services/package.service.js';
import { sendSuccess } from '../utils/response.js';

export class PackageController {
  static async listPackages(req: Request, res: Response, next: NextFunction) {
    try {
      const isArchived = req.query.isArchived !== undefined ? req.query.isArchived === 'true' : undefined;
      const includeArchived = req.query.includeArchived === 'true';
      const packages = await PackageService.listPackages({ isArchived, includeArchived });
      return sendSuccess(res, packages, 'Packages retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async getPackageById(req: Request, res: Response, next: NextFunction) {
    try {
      const pkg = await PackageService.getPackageById(req.params.id);
      return sendSuccess(res, pkg, 'Package details');
    } catch (error) {
      next(error);
    }
  }

  static async createPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const pkg = await PackageService.createPackage(req.body);
      return sendSuccess(res, pkg, 'Package created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updatePackage(req: Request, res: Response, next: NextFunction) {
    try {
      const pkg = await PackageService.updatePackage(req.params.id, req.body);
      return sendSuccess(res, pkg, 'Package updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async archivePackage(req: Request, res: Response, next: NextFunction) {
    try {
      const isArchived = req.body.isArchived !== undefined ? Boolean(req.body.isArchived) : true;
      const pkg = await PackageService.archivePackage(req.params.id, isArchived);
      return sendSuccess(res, pkg, isArchived ? 'Package archived successfully' : 'Package restored successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deletePackage(req: Request, res: Response, next: NextFunction) {
    try {
      await PackageService.deletePackage(req.params.id);
      return sendSuccess(res, null, 'Package deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // Service item endpoints
  static async listServices(req: Request, res: Response, next: NextFunction) {
    try {
      const services = await ServiceItemService.listServices();
      return sendSuccess(res, services, 'Services retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createService(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await ServiceItemService.createService(req.body);
      return sendSuccess(res, service, 'Service created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async getServiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await ServiceItemService.getServiceById(req.params.id);
      return sendSuccess(res, service, 'Service retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async updateService(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await ServiceItemService.updateService(req.params.id, req.body);
      return sendSuccess(res, service, 'Service updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteService(req: Request, res: Response, next: NextFunction) {
    try {
      await ServiceItemService.deleteService(req.params.id);
      return sendSuccess(res, null, 'Service deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

