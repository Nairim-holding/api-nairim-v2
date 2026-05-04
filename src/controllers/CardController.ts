import { Request, Response } from 'express';
import { CardService } from '../services/CardService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { CardValidator } from '../lib/validators/card';

export class CardController {
  static async getCards(req: Request, res: Response) {
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
      const result = await CardService.getCards(params);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Erro ao buscar cartões:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getCardById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      
      const data = await CardService.getCardById(id);
      res.status(200).json(ApiResponse.success(data, 'Cartão encontrado com sucesso'));
    } catch (error: any) {
      if (error.message === 'Card not found') return res.status(404).json(ApiResponse.error('Cartão não encontrado'));
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async createCard(req: Request, res: Response) {
    try {
      const validation = CardValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const data = await CardService.createCard(req.body);
      res.status(201).json(ApiResponse.success(data, 'Cartão criado com sucesso'));
    } catch (error: any) {
      res.status(400).json(ApiResponse.error(`Erro: ${error.message}`));
    }
  }

  static async updateCard(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      const validation = CardValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const data = await CardService.updateCard(id, req.body);
      res.status(200).json(ApiResponse.success(data, 'Cartão atualizado com sucesso'));
    } catch (error: any) {
      if (error.message === 'Card not found') return res.status(404).json(ApiResponse.error('Cartão não encontrado'));
      res.status(400).json(ApiResponse.error(`Erro: ${error.message}`));
    }
  }

  static async deleteCard(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      await CardService.deleteCard(id);
      res.status(200).json(ApiResponse.success(null, 'Cartão deletado com sucesso.'));
    } catch (error: any) {
      if (error.message === 'Card not found or already deleted') return res.status(404).json(ApiResponse.error('Cartão não encontrado'));
      if (error.message.includes('lançamentos')) return res.status(409).json(ApiResponse.error(error.message));
      
      res.status(500).json(ApiResponse.error('Erro ao deletar cartão'));
    }
  }

  static async restoreCard(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      await CardService.restoreCard(id);
      res.status(200).json(ApiResponse.success(null, 'Cartão restaurado com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao restaurar cartão'));
    }
  }

  static async getFilters(req: Request, res: Response) {
    try {
      const filtersData = await CardService.getCardFilters();
      res.status(200).json(ApiResponse.success(filtersData, 'Filtros recuperados com sucesso'));
    } catch (error) {
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async quickCreate(req: Request, res: Response) {
    try {
      const { name } = req.body ?? {};
      if (!name) return res.status(400).json(ApiResponse.error('Nome é obrigatório'));
      
      const data = await CardService.quickCreate({ name });
      res.status(201).json(ApiResponse.success(data, 'Cartão criado com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error(error.message));
    }
  }
}