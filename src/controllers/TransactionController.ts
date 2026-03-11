import { Request, Response } from 'express';
import { TransactionService } from '../services/TransactionService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { TransactionValidator } from '../lib/validators/transaction';

export class TransactionController {
  static async getTransactions(req: Request, res: Response) {
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
            if (filterMatch) {
              filters[filterMatch[1]] = value;
            } else {
              try { filters[key] = JSON.parse(value); } 
              catch { filters[key] = value; }
            }
          }
        }
      });

      const params = { limit, page, search, filters, sortOptions, includeInactive };
      const result = await TransactionService.getTransactions(params);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error getting transactions:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getTransactionById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      
      const data = await TransactionService.getTransactionById(id);
      res.status(200).json(ApiResponse.success(data, 'Transaction retrieved successfully'));
    } catch (error: any) {
      if (error.message === 'Transaction not found') return res.status(404).json(ApiResponse.error('Lançamento não encontrado'));
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getFilters(req: Request, res: Response) {
    try {
      const filtersData = await TransactionService.getTransactionFilters(req.query);
      res.status(200).json(ApiResponse.success(filtersData, 'Filters retrieved successfully'));
    } catch (error) {
      console.error('Error getting transaction filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createTransaction(req: Request, res: Response) {
    try {
      const validation = TransactionValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const data = await TransactionService.createTransaction(req.body);
      res.status(201).json(ApiResponse.success(data, 'Lançamento criado com sucesso'));
    } catch (error: any) {
      res.status(400).json(ApiResponse.error(`Erro: ${error.message}`));
    }
  }

  static async updateTransaction(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      const validation = TransactionValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const data = await TransactionService.updateTransaction(id, req.body);
      res.status(200).json(ApiResponse.success(data, 'Lançamento atualizado com sucesso'));
    } catch (error: any) {
      if (error.message === 'Transaction not found') return res.status(404).json(ApiResponse.error('Lançamento não encontrado'));
      res.status(400).json(ApiResponse.error(`Erro: ${error.message}`));
    }
  }

  static async deleteTransaction(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      await TransactionService.deleteTransaction(id);
      res.status(200).json(ApiResponse.success(null, 'Lançamento apagado com sucesso.'));
    } catch (error: any) {
      if (error.message === 'Transaction not found or already deleted') return res.status(404).json(ApiResponse.error('Lançamento não encontrado'));
      res.status(500).json(ApiResponse.error('Erro ao apagar o lançamento'));
    }
  }

  static async restoreTransaction(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      await TransactionService.restoreTransaction(id);
      res.status(200).json(ApiResponse.success(null, 'Lançamento restaurado com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao restaurar lançamento'));
    }
  }
}