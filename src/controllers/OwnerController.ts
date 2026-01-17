import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { OwnerValidator } from '../lib/validators/owner';
import { OwnerService } from '@/services/OwnerService';

export class OwnerController {
  static async getOwners(req: Request, res: Response) {
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

      const validation = OwnerValidator.validateQueryParams(req.query);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const result = await OwnerService.getOwners({
        limit,
        page,
        search,
        sortOptions,
        includeInactive,
      });

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting owners:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getOwnerById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const owner = await OwnerService.getOwnerById(id);

      res.status(200).json(
        ApiResponse.success(owner, 'Owner retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'Owner not found') {
        return res.status(404).json(ApiResponse.error('Owner not found'));
      }
      console.error('Error getting owner:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createOwner(req: Request, res: Response) {
    try {
      const validation = OwnerValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const owner = await OwnerService.createOwner(req.body);

      res.status(201).json(
        ApiResponse.success(owner, `Owner ${owner.name} created successfully`)
      );
    } catch (error: any) {
      console.error('Error creating owner:', error);
      
      if (error.message === 'CPF already registered') {
        return res.status(409).json(ApiResponse.error('CPF already registered'));
      }
      
      if (error.message === 'CNPJ already registered') {
        return res.status(409).json(ApiResponse.error('CNPJ already registered'));
      }

      res.status(400).json(ApiResponse.error(`Error creating owner: ${error.message}`));
    }
  }

  static async updateOwner(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const validation = OwnerValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const owner = await OwnerService.updateOwner(id, req.body);

      res.status(200).json(
        ApiResponse.success(owner, `Owner ${owner.name} updated successfully`)
      );
    } catch (error: any) {
      console.error('Error updating owner:', error);

      if (error.message === 'Owner not found') {
        return res.status(404).json(ApiResponse.error('Owner not found'));
      }

      if (error.message === 'CPF already registered for another owner') {
        return res.status(409).json(ApiResponse.error('CPF already registered for another owner'));
      }

      if (error.message === 'CNPJ already registered for another owner') {
        return res.status(409).json(ApiResponse.error('CNPJ already registered for another owner'));
      }

      res.status(400).json(ApiResponse.error(`Error updating owner: ${error.message}`));
    }
  }

  static async deleteOwner(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const owner = await OwnerService.deleteOwner(id);

      res.status(200).json(
        ApiResponse.success(null, `Owner ${owner.name} marked as deleted successfully`)
      );
    } catch (error: any) {
      console.error('Error deleting owner:', error);

      if (error.message === 'Owner not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Owner not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting owner'));
    }
  }

  static async restoreOwner(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const owner = await OwnerService.restoreOwner(id);

      res.status(200).json(
        ApiResponse.success(null, `Owner ${owner.name} restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring owner:', error);

      if (error.message === 'Owner not found') {
        return res.status(404).json(ApiResponse.error('Owner not found'));
      }

      if (error.message === 'Owner is not deleted') {
        return res.status(400).json(ApiResponse.error('Owner is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring owner'));
    }
  }

  static async getOwnerFilters(req: Request, res: Response) {
    try {
      const filters = await OwnerService.getOwnerFilters();
      res.status(200).json(
        ApiResponse.success(filters, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('Error getting filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}