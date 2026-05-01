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
      console.error('Erro ao buscar fornecedores:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getSupplierById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      
      const data = await SupplierService.getSupplierById(id);
      res.status(200).json(ApiResponse.success(data, 'Fornecedor recuperado com sucesso'));
    } catch (error: any) {
      if (error.message === 'Supplier not found') return res.status(404).json(ApiResponse.error('Fornecedor não encontrado'));
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async createSupplier(req: Request, res: Response) {
    try {
      const validation = SupplierValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const data = await SupplierService.createSupplier(req.body);
      res.status(201).json(ApiResponse.success(data, 'Fornecedor criado com sucesso'));
    } catch (error: any) {
      if (error.message === 'CNPJ already registered') return res.status(409).json(ApiResponse.error('Este CNPJ já está cadastrado'));
      res.status(400).json(ApiResponse.error(`Erro: ${error.message}`));
    }
  }

  static async updateSupplier(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      const validation = SupplierValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const data = await SupplierService.updateSupplier(id, req.body);
      res.status(200).json(ApiResponse.success(data, 'Fornecedor atualizado com sucesso'));
    } catch (error: any) {
      if (error.message === 'Supplier not found') return res.status(404).json(ApiResponse.error('Fornecedor não encontrado'));
      if (error.message.includes('CNPJ already registered')) return res.status(409).json(ApiResponse.error('Este CNPJ já está cadastrado para outro fornecedor'));
      res.status(400).json(ApiResponse.error(`Erro: ${error.message}`));
    }
  }

  static async deleteSupplier(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      await SupplierService.deleteSupplier(id);
      res.status(200).json(ApiResponse.success(null, 'Fornecedor deletado com sucesso.'));
    } catch (error: any) {
      if (error.message === 'Supplier not found or already deleted') return res.status(404).json(ApiResponse.error('Fornecedor não encontrado'));
      res.status(500).json(ApiResponse.error('Erro ao deletar fornecedor'));
    }
  }

  static async restoreSupplier(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      await SupplierService.restoreSupplier(id);
      res.status(200).json(ApiResponse.success(null, 'Fornecedor restaurado com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao restaurar fornecedor'));
    }
  }

  static async getFilters(req: Request, res: Response) {
    try {
      const filtersData = await SupplierService.getSupplierFilters();
      res.status(200).json(ApiResponse.success(filtersData, 'Filtros recuperados com sucesso'));
    } catch (error) {
      res.status(500).json(ApiResponse.error('Erro interno do servidor ao buscar filtros'));
    }
  }

  static async quickCreate(req: Request, res: Response) {
    try {
      const { legal_name } = req.body ?? {};
      
      if (!legal_name || typeof legal_name !== 'string') {
        return res.status(400).json(ApiResponse.error('legal_name é obrigatório e deve ser uma string'));
      }
      
      const data = await SupplierService.quickCreate({ legal_name });
      res.status(201).json(ApiResponse.success(data, 'Fornecedor criado com sucesso'));
    } catch (error: any) {
      if (error.message.includes('legal_name é obrigatório')) {
        return res.status(400).json(ApiResponse.error(error.message));
      }
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }
}