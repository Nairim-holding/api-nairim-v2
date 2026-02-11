// controllers/OwnerController.ts
import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { OwnerValidator } from '../lib/validators/owner';
import { OwnerService } from '@/services/OwnerService';
import {
  GetOwnersParams,
  CreateOwnerInput,
  UpdateOwnerInput,
  OwnerWithRelations
} from '../types/owner';

export class OwnerController {
  static async getOwners(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 30);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      // Processar sort no formato sort[field]=direction
      const sortOptions: Record<string, 'asc' | 'desc'> = {};
      const filters: Record<string, any> = {};
      
      console.log('📥 Query params recebidos para proprietários:', req.query);
      
      // Processar parâmetros de ordenação
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (typeof value === 'string') {
          // Verificar se é parâmetro de ordenação no formato sort[field]
          const sortMatch = key.match(/^sort\[(.+)\]$/);
          if (sortMatch) {
            const field = sortMatch[1];
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') {
              sortOptions[field] = direction;
              console.log(`📌 Ordenação detectada: ${field} -> ${direction}`);
            }
          }
          // Processar filtros
          else if (!['limit', 'page', 'search', 'includeInactive'].includes(key) && value.trim() !== '') {
            // Verificar se é filtro no formato filter[field]
            const filterMatch = key.match(/^filter\[(.+)\]$/);
            if (filterMatch) {
              const field = filterMatch[1];
              filters[field] = value;
            }
            // Tratar outros parâmetros como filtros diretos
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

      console.log('🔍 Sort options extraídos:', sortOptions);
      console.log('📋 Filtros extraídos:', filters);

      const params: GetOwnersParams = {
        limit,
        page,
        search,
        filters,
        sortOptions,
        includeInactive,
      };

      const result = await OwnerService.getOwners(params);

      // Desabilitar cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
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
      // Extrair filtros dos query params para contexto
      const filters: Record<string, any> = {};
      
      console.log('📥 Received query params for owner filters:', req.query);

      // Processar parâmetros de filtro
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          console.log(`🔧 Processing filter param: ${key} =`, value);
          
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

      console.log('📋 Parsed filters for context:', filters);

      const filtersData = await OwnerService.getOwnerFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('❌ Error getting owner filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getContactSuggestions(req: Request, res: Response) {
    try {
      const search = ValidationUtil.parseStringParam(req.query?.search);
      
      const suggestions = await OwnerService.getAvailableContacts(search);

      // Cache curto para agilizar o autocomplete no front
      res.setHeader('Cache-Control', 'public, max-age=30'); // 30 segundos de cache
      
      res.status(200).json(
        ApiResponse.success(suggestions, 'Contact suggestions retrieved successfully')
      );
    } catch (error: any) {
      console.error('Error getting contact suggestions:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}