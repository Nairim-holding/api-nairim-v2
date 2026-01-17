import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { TenantValidator } from '../lib/validators/tenant';
import { TenantService } from '@/services/TenantService';

export class TenantController {
  static async getTenants(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      const sortOptions = {
        sort_id: ValidationUtil.parseStringParam(req.query?.sort_id),
        sort_name: ValidationUtil.parseStringParam(req.query?.sort_name),
        sort_internal_code: ValidationUtil.parseStringParam(req.query?.sort_internal_code),
        sort_occupation: ValidationUtil.parseStringParam(req.query?.sort_occupation),
        sort_marital_status: ValidationUtil.parseStringParam(req.query?.sort_marital_status),
        sort_cnpj: ValidationUtil.parseStringParam(req.query?.sort_cnpj),
        sort_cpf: ValidationUtil.parseStringParam(req.query?.sort_cpf),
      };

      const validation = TenantValidator.validateQueryParams(req.query);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const result = await TenantService.getTenants({
        limit,
        page,
        search,
        sortOptions,
        includeInactive,
      });

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting tenants:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getTenantById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const tenant = await TenantService.getTenantById(id);

      res.status(200).json(
        ApiResponse.success(tenant, 'Tenant retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'Tenant not found') {
        return res.status(404).json(ApiResponse.error('Tenant not found'));
      }
      console.error('Error getting tenant:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createTenant(req: Request, res: Response) {
    try {
      const validation = TenantValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const tenant = await TenantService.createTenant(req.body);

      res.status(201).json(
        ApiResponse.success(tenant, `Tenant ${tenant.name} created successfully`)
      );
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      
      if (error.message === 'CPF already registered') {
        return res.status(409).json(ApiResponse.error('CPF already registered'));
      }
      
      if (error.message === 'CNPJ already registered') {
        return res.status(409).json(ApiResponse.error('CNPJ already registered'));
      }

      res.status(400).json(ApiResponse.error(`Error creating tenant: ${error.message}`));
    }
  }

  static async updateTenant(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const validation = TenantValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const tenant = await TenantService.updateTenant(id, req.body);

      res.status(200).json(
        ApiResponse.success(tenant, `Tenant ${tenant.name} updated successfully`)
      );
    } catch (error: any) {
      console.error('Error updating tenant:', error);

      if (error.message === 'Tenant not found') {
        return res.status(404).json(ApiResponse.error('Tenant not found'));
      }

      if (error.message === 'CPF already registered for another tenant') {
        return res.status(409).json(ApiResponse.error('CPF already registered for another tenant'));
      }

      if (error.message === 'CNPJ already registered for another tenant') {
        return res.status(409).json(ApiResponse.error('CNPJ already registered for another tenant'));
      }

      res.status(400).json(ApiResponse.error(`Error updating tenant: ${error.message}`));
    }
  }

  static async deleteTenant(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const tenant = await TenantService.deleteTenant(id);

      res.status(200).json(
        ApiResponse.success(null, `Tenant ${tenant.name} marked as deleted successfully`)
      );
    } catch (error: any) {
      console.error('Error deleting tenant:', error);

      if (error.message === 'Tenant not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Tenant not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting tenant'));
    }
  }

  static async restoreTenant(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const tenant = await TenantService.restoreTenant(id);

      res.status(200).json(
        ApiResponse.success(null, `Tenant ${tenant.name} restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring tenant:', error);

      if (error.message === 'Tenant not found') {
        return res.status(404).json(ApiResponse.error('Tenant not found'));
      }

      if (error.message === 'Tenant is not deleted') {
        return res.status(400).json(ApiResponse.error('Tenant is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring tenant'));
    }
  }

  static async getTenantFilters(req: Request, res: Response) {
    try {
      const filters = await TenantService.getTenantFilters();
      res.status(200).json(
        ApiResponse.success(filters, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('Error getting filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}