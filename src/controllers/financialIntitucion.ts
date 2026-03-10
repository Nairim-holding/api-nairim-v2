import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { FinancialInstitutionService } from '@/services/financialIntitucion';
import { FinancialInstitutionValidator } from '@/lib/validators/financialIntitucion';

export class FinancialInstitutionController {
  static async getInstitutions(req: Request, res: Response) {
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
      const result = await FinancialInstitutionService.getInstitutions(params);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getInstitutionById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));
      
      const data = await FinancialInstitutionService.getInstitutionById(id);
      res.status(200).json(ApiResponse.success(data, 'Institution retrieved successfully'));
    } catch (error: any) {
      if (error.message === 'Institution not found') return res.status(404).json(ApiResponse.error('Institution not found'));
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createInstitution(req: Request, res: Response) {
    try {
      const validation = FinancialInstitutionValidator.validateCreate(req.body);
      if (!validation.isValid) return res.status(400).json(ApiResponse.error('Validation error', validation.errors));

      const data = await FinancialInstitutionService.createInstitution(req.body);
      res.status(201).json(ApiResponse.success(data, 'Institution created successfully'));
    } catch (error: any) {
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async updateInstitution(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      const validation = FinancialInstitutionValidator.validateUpdate(req.body);
      if (!validation.isValid) return res.status(400).json(ApiResponse.error('Validation error', validation.errors));

      const data = await FinancialInstitutionService.updateInstitution(id, req.body);
      res.status(200).json(ApiResponse.success(data, 'Institution updated successfully'));
    } catch (error: any) {
      if (error.message === 'Institution not found') return res.status(404).json(ApiResponse.error('Institution not found'));
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async deleteInstitution(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await FinancialInstitutionService.deleteInstitution(id);
      res.status(200).json(ApiResponse.success(null, 'Instituição financeira deletada com sucesso.'));
    } catch (error: any) {
      if (error.message === 'Institution not found or already deleted') return res.status(404).json(ApiResponse.error('Institution not found'));
      if (error.message.includes('lançamentos relacionados')) return res.status(409).json(ApiResponse.error(error.message));
      res.status(500).json(ApiResponse.error('Error deleting institution'));
    }
  }

  static async restoreInstitution(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await FinancialInstitutionService.restoreInstitution(id);
      res.status(200).json(ApiResponse.success(null, 'Institution restored successfully'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Error restoring institution'));
    }
  }

  static async getFilters(req: Request, res: Response) {
    try {
      const filtersData = await FinancialInstitutionService.getInstitutionFilters(req.query);
      res.status(200).json(ApiResponse.success(filtersData, 'Filters retrieved successfully'));
    } catch (error) {
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}