import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { TenantValidator } from '../lib/validators/tenant';
import { TenantService } from '@/services/TenantService';

export class TenantController {
  static async getTenants(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 30);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      const sortOptions: Record<string, 'asc' | 'desc'> = {};
      const filters: Record<string, any> = {};
      
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (typeof value === 'string') {
          const sortMatch = key.match(/^sort\[(.+)\]$/);
          if (sortMatch) {
            const field = sortMatch[1];
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') {
              sortOptions[field] = direction;
            }
          }
          else if (!['limit', 'page', 'search', 'includeInactive'].includes(key) && value.trim() !== '') {
            const filterMatch = key.match(/^filter\[(.+)\]$/);
            if (filterMatch) {
              const field = filterMatch[1];
              filters[field] = value;
            }
            else if (key !== 'sort' && !key.startsWith('sort[')) {
              try {
                const parsedValue = JSON.parse(value);
                filters[key] = parsedValue;
              } catch {
                filters[key] = value;
              }
            }
          }
        }
      });

      const result = await TenantService.getTenants({
        limit,
        page,
        search,
        filters,
        sortOptions,
        includeInactive,
      });

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.status(200).json(result);

    } catch (error: any) {
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
      if (error.message === 'Internal code already registered') {
        return res.status(409).json(ApiResponse.error('O Código Interno informado já está em uso por outro inquilino'));
      }

      if (error.message === 'CPF already registered') {
        return res.status(409).json(ApiResponse.error('O CPF informado já está cadastrado'));
      }
      
      if (error.message === 'CNPJ already registered') {
        return res.status(409).json(ApiResponse.error('O CNPJ informado já está cadastrado'));
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
      if (error.message === 'Internal code already registered for another tenant') {
        return res.status(409).json(ApiResponse.error('O Código Interno informado já está em uso por outro inquilino'));
      }

      if (error.message === 'Tenant not found') {
        return res.status(404).json(ApiResponse.error('Tenant not found'));
      }

      if (error.message === 'CPF already registered for another tenant') {
        return res.status(409).json(ApiResponse.error('O CPF informado já está cadastrado para outro inquilino'));
      }

      if (error.message === 'CNPJ already registered for another tenant') {
        return res.status(409).json(ApiResponse.error('O CNPJ informado já está cadastrado para outro inquilino'));
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
      const filters: Record<string, any> = {};

      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          try {
            const parsedValue = JSON.parse(value as string);
            if (parsedValue && typeof parsedValue === 'object') {
              filters[key] = parsedValue;
            } else {
              filters[key] = value;
            }
          } catch {
            filters[key] = value;
          }
        }
      });

      const filtersData = await TenantService.getTenantFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filters retrieved successfully')
      );
    } catch (error) {
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getContactSuggestions(req: Request, res: Response) {
    try {
      const search = ValidationUtil.parseStringParam(req.query?.search);
      
      const suggestions = await TenantService.getAvailableContacts(search);

      res.setHeader('Cache-Control', 'public, max-age=30'); 
      
      res.status(200).json(
        ApiResponse.success(suggestions, 'Contact suggestions retrieved successfully')
      );
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}