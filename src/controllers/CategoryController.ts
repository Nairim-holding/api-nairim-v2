import { Request, Response } from 'express';
import { CategoryService } from '../services/CategoryService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { CategoryValidator } from '../lib/validators/category';

export class CategoryController {
  static async getCategories(req: Request, res: Response) {
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
      const result = await CategoryService.getCategories(params);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error getting categories:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getCategoryById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));
      
      const data = await CategoryService.getCategoryById(id);
      res.status(200).json(ApiResponse.success(data, 'Category retrieved successfully'));
    } catch (error: any) {
      if (error.message === 'Category not found') return res.status(404).json(ApiResponse.error('Category not found'));
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createCategory(req: Request, res: Response) {
    try {
      const validation = CategoryValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const data = await CategoryService.createCategory(req.body);
      res.status(201).json(ApiResponse.success(data, 'Category created successfully'));
    } catch (error: any) {
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async updateCategory(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      const validation = CategoryValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const data = await CategoryService.updateCategory(id, req.body);
      res.status(200).json(ApiResponse.success(data, 'Category updated successfully'));
    } catch (error: any) {
      if (error.message === 'Category not found') return res.status(404).json(ApiResponse.error('Category not found'));
      if (error.message.includes('sistema')) return res.status(403).json(ApiResponse.error(error.message));
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async deleteCategory(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await CategoryService.deleteCategory(id);
      res.status(200).json(ApiResponse.success(null, 'Categoria deletada com sucesso.'));
    } catch (error: any) {
      if (error.message === 'Category not found or already deleted') return res.status(404).json(ApiResponse.error('Category not found'));
      if (error.message.includes('lançamentos') || error.message.includes('subcategorias')) return res.status(409).json(ApiResponse.error(error.message));
      if (error.message.includes('sistema')) return res.status(403).json(ApiResponse.error(error.message));
      
      res.status(500).json(ApiResponse.error('Error deleting category'));
    }
  }

  static async restoreCategory(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await CategoryService.restoreCategory(id);
      res.status(200).json(ApiResponse.success(null, 'Category restored successfully'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Error restoring category'));
    }
  }

  static async getFilters(req: Request, res: Response) {
    try {
      const filtersData = await CategoryService.getCategoryFilters(req.query);
      res.status(200).json(ApiResponse.success(filtersData, 'Filters retrieved successfully'));
    } catch (error) {
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}