import { Request, Response } from 'express';
import { CenterService } from '../services/CenterService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { CenterValidator } from '../lib/validators/center';

export class CenterController {
  static async getCenters(req: Request, res: Response) {
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
      const result = await CenterService.getCenters(params);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error getting centers:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getCenterById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));
      
      const data = await CenterService.getCenterById(id);
      res.status(200).json(ApiResponse.success(data, 'Center retrieved successfully'));
    } catch (error: any) {
      if (error.message === 'Center not found') return res.status(404).json(ApiResponse.error('Center not found'));
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createCenter(req: Request, res: Response) {
    try {
      const validation = CenterValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const data = await CenterService.createCenter(req.body);
      res.status(201).json(ApiResponse.success(data, 'Center created successfully'));
    } catch (error: any) {
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async updateCenter(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      const validation = CenterValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const data = await CenterService.updateCenter(id, req.body);
      res.status(200).json(ApiResponse.success(data, 'Center updated successfully'));
    } catch (error: any) {
      if (error.message === 'Center not found') return res.status(404).json(ApiResponse.error('Center not found'));
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async deleteCenter(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await CenterService.deleteCenter(id);
      res.status(200).json(ApiResponse.success(null, 'Centro deletado com sucesso.'));
    } catch (error: any) {
      if (error.message === 'Center not found or already deleted') return res.status(404).json(ApiResponse.error('Center not found'));
      if (error.message.includes('lançamentos')) return res.status(409).json(ApiResponse.error(error.message));
      
      res.status(500).json(ApiResponse.error('Error deleting center'));
    }
  }

  static async restoreCenter(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await CenterService.restoreCenter(id);
      res.status(200).json(ApiResponse.success(null, 'Center restored successfully'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Error restoring center'));
    }
  }

  static async getFilters(req: Request, res: Response) {
    try {
      const filtersData = await CenterService.getCenterFilters(req.query);
      res.status(200).json(ApiResponse.success(filtersData, 'Filters retrieved successfully'));
    } catch (error) {
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}