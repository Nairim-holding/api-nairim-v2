import { Request, Response } from 'express';
import { SupplierService } from '../services/SupplierService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { SupplierValidator } from '../lib/validators/supplier';

export class SupplierController {
  static async getSuppliers(req: Request, res: Response) {
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
      const result = await SupplierService.getSuppliers(params);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error getting suppliers:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getSupplierById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));
      
      const data = await SupplierService.getSupplierById(id);
      res.status(200).json(ApiResponse.success(data, 'Supplier retrieved successfully'));
    } catch (error: any) {
      if (error.message === 'Supplier not found') return res.status(404).json(ApiResponse.error('Supplier not found'));
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createSupplier(req: Request, res: Response) {
    try {
      const validation = SupplierValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const data = await SupplierService.createSupplier(req.body);
      res.status(201).json(ApiResponse.success(data, 'Supplier created successfully'));
    } catch (error: any) {
      if (error.message === 'CNPJ already registered') return res.status(409).json(ApiResponse.error(error.message));
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async updateSupplier(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      const validation = SupplierValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const data = await SupplierService.updateSupplier(id, req.body);
      res.status(200).json(ApiResponse.success(data, 'Supplier updated successfully'));
    } catch (error: any) {
      if (error.message === 'Supplier not found') return res.status(404).json(ApiResponse.error('Supplier not found'));
      if (error.message.includes('CNPJ already registered')) return res.status(409).json(ApiResponse.error(error.message));
      res.status(400).json(ApiResponse.error(`Error: ${error.message}`));
    }
  }

  static async deleteSupplier(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await SupplierService.deleteSupplier(id);
      res.status(200).json(ApiResponse.success(null, 'Fornecedor deletado com sucesso.'));
    } catch (error: any) {
      if (error.message === 'Supplier not found or already deleted') return res.status(404).json(ApiResponse.error('Supplier not found'));
      res.status(500).json(ApiResponse.error('Error deleting supplier'));
    }
  }

  static async restoreSupplier(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      await SupplierService.restoreSupplier(id);
      res.status(200).json(ApiResponse.success(null, 'Supplier restored successfully'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Error restoring supplier'));
    }
  }

  static async getFilters(req: Request, res: Response) {
    try {
      const filtersData = await SupplierService.getSupplierFilters(req.query);
      res.status(200).json(ApiResponse.success(filtersData, 'Filters retrieved successfully'));
    } catch (error) {
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}