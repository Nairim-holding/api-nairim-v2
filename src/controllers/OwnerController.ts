import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { OwnerValidator } from '../lib/validators/owner';
import { OwnerService } from '@/services/OwnerService';
import {
  GetOwnersParams,
  CreateOwnerInput,
  UpdateOwnerInput,
} from '../types/owner';

export class OwnerController {
  static async getOwners(req: Request, res: Response) {
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

      const params: GetOwnersParams = {
        limit,
        page,
        search,
        filters,
        sortOptions,
        includeInactive,
      };

      const result = await OwnerService.getOwners(params);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.status(200).json(result);

    } catch (error: any) {
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
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createOwner(req: Request, res: Response) {
    try {
      const ownerData: CreateOwnerInput = req.body;
      
      const validation = OwnerValidator.validateCreate(ownerData);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const owner = await OwnerService.createOwner(ownerData);

      res.status(201).json(
        ApiResponse.success(owner, `Owner ${owner.name} created successfully`)
      );
    } catch (error: any) {
      if (error.message === 'Internal code already registered') {
        return res.status(409).json(ApiResponse.error('O Código Interno informado já está em uso por outro proprietário'));
      }

      if (error.message === 'CPF already registered') {
        return res.status(409).json(ApiResponse.error('O CPF informado já está cadastrado'));
      }
      
      if (error.message === 'CNPJ already registered') {
        return res.status(409).json(ApiResponse.error('O CNPJ informado já está cadastrado'));
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

      const ownerData: UpdateOwnerInput = req.body;

      const validation = OwnerValidator.validateUpdate(ownerData);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const owner = await OwnerService.updateOwner(id, ownerData);

      res.status(200).json(
        ApiResponse.success(owner, `Owner ${owner.name} updated successfully`)
      );
    } catch (error: any) {
      if (error.message === 'Internal code already registered for another owner') {
        return res.status(409).json(ApiResponse.error('O Código Interno informado já está em uso por outro proprietário'));
      }

      if (error.message === 'Owner not found') {
        return res.status(404).json(ApiResponse.error('Owner not found'));
      }

      if (error.message === 'CPF already registered for another owner') {
        return res.status(409).json(ApiResponse.error('O CPF informado já está cadastrado para outro proprietário'));
      }

      if (error.message === 'CNPJ already registered for another owner') {
        return res.status(409).json(ApiResponse.error('O CNPJ informado já está cadastrado para outro proprietário'));
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

      const filtersData = await OwnerService.getOwnerFilters(filters);
      
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
      
      const suggestions = await OwnerService.getAvailableContacts(search);

      res.setHeader('Cache-Control', 'public, max-age=30');
      
      res.status(200).json(
        ApiResponse.success(suggestions, 'Contact suggestions retrieved successfully')
      );
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}