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
      console.error('Erro ao buscar subcategorias:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getSubcategoryById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      
      const data = await SubcategoryService.getSubcategoryById(id);
      res.status(200).json(ApiResponse.success(data, 'Subcategoria recuperada com sucesso'));
    } catch (error: any) {
      if (error.message === 'Subcategory not found') return res.status(404).json(ApiResponse.error('Subcategoria não encontrada'));
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async createSubcategory(req: Request, res: Response) {
    try {
      const validation = SubcategoryValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const data = await SubcategoryService.createSubcategory(req.body);
      res.status(201).json(ApiResponse.success(data, 'Subcategoria criada com sucesso'));
    } catch (error: any) {
      if (error.message === 'Categoria pai não encontrada') return res.status(404).json(ApiResponse.error(error.message));
      res.status(400).json(ApiResponse.error(`Erro: ${error.message}`));
    }
  }

  static async updateSubcategory(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      const validation = SubcategoryValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const data = await SubcategoryService.updateSubcategory(id, req.body);
      res.status(200).json(ApiResponse.success(data, 'Subcategoria atualizada com sucesso'));
    } catch (error: any) {
      if (error.message === 'Subcategory not found' || error.message === 'Categoria pai não encontrada') {
        return res.status(404).json(ApiResponse.error(error.message));
      }
      res.status(400).json(ApiResponse.error(`Erro: ${error.message}`));
    }
  }

  static async deleteSubcategory(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      await SubcategoryService.deleteSubcategory(id);
      res.status(200).json(ApiResponse.success(null, 'Subcategoria deletada com sucesso.'));
    } catch (error: any) {
      if (error.message === 'Subcategory not found or already deleted') return res.status(404).json(ApiResponse.error('Subcategoria não encontrada'));
      if (error.message.includes('lançamentos')) return res.status(409).json(ApiResponse.error(error.message));
      
      res.status(500).json(ApiResponse.error('Erro ao deletar subcategoria'));
    }
  }

  static async restoreSubcategory(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      await SubcategoryService.restoreSubcategory(id);
      res.status(200).json(ApiResponse.success(null, 'Subcategoria restaurada com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao restaurar subcategoria'));
    }
  }

  static async getFilters(req: Request, res: Response) {
    try {
      const filtersData = await SubcategoryService.getSubcategoryFilters();
      res.status(200).json(ApiResponse.success(filtersData, 'Filtros recuperados com sucesso'));
    } catch (error) {
      res.status(500).json(ApiResponse.error('Erro interno do servidor ao buscar filtros'));
    }
  }
}