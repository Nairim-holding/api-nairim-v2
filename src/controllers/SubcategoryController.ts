import { Request, Response } from 'express';
import { SubcategoryService } from '../services/SubcategoryService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { SubcategoryValidator } from '../lib/validators/subcategory';

export class SubcategoryController {
  static async getSubcategories(req: Request, res: Response) {
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
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') sortOptions[sortMatch[1]] = direction;
          } else if (!['limit', 'page', 'search', 'includeInactive'].includes(key) && value.trim() !== '') {
            const filterMatch = key.match(/^filter\[(.+)\]$/);
            if (filterMatch) filters[filterMatch[1]] = value;
            else filters[key] = value;
          }
        }
      });

      const params = { limit, page, search, filters, sortOptions, includeInactive };
      const result = await SubcategoryService.getSubcategories(params);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error getting subcategories:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getSubcategoryById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));
      
      const data = await SubcategoryService.getSubcategoryById(id);
      res.status(200).json(ApiResponse.success(data, 'Subcategory retrieved successfully'));
    } catch (error: any) {
      if (error.message === 'Subcategory not found') return res.status(404).json(ApiResponse.error('Subcategory not found'));
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createSubcategory(req: Request, res: Response) {
    try {
      const validation = SubcategoryValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const data = await SubcategoryService.createSubcategory(req.body);
      res.status(201).json(ApiResponse.success(data, 'Subcategory created successfully'));
    } catch (error: any) {
      if (error.message === 'Categoria pai não encontrada') return res.status(404).json(ApiResponse.error(error.message));
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async updateSubcategory(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      const validation = SubcategoryValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const data = await SubcategoryService.updateSubcategory(id, req.body);
      res.status(200).json(ApiResponse.success(data, 'Subcategory updated successfully'));
    } catch (error: any) {
      if (error.message === 'Subcategory not found' || error.message === 'Categoria pai não encontrada') {
        return res.status(404).json(ApiResponse.error(error.message));
      }
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async deleteSubcategory(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await SubcategoryService.deleteSubcategory(id);
      res.status(200).json(ApiResponse.success(null, 'Subcategoria deletada com sucesso.'));
    } catch (error: any) {
      if (error.message === 'Subcategory not found or already deleted') return res.status(404).json(ApiResponse.error('Subcategory not found'));
      if (error.message.includes('lançamentos')) return res.status(409).json(ApiResponse.error(error.message));
      
      res.status(500).json(ApiResponse.error('Error deleting subcategory'));
    }
  }

  static async restoreSubcategory(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await SubcategoryService.restoreSubcategory(id);
      res.status(200).json(ApiResponse.success(null, 'Subcategory restored successfully'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Error restoring subcategory'));
    }
  }

  static async getFilters(req: Request, res: Response) {
    try {
      const filtersData = await SubcategoryService.getSubcategoryFilters(req.query);
      res.status(200).json(ApiResponse.success(filtersData, 'Filters retrieved successfully'));
    } catch (error) {
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}