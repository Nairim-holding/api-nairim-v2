import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { PublicService } from '../services/PublicService';

function listParams(req: Request) {
  return {
    limit: ValidationUtil.parseNumberParam(req.query?.limit, 12),
    page: ValidationUtil.parseNumberParam(req.query?.page, 1),
    search: ValidationUtil.parseStringParam(req.query?.search) || '',
  };
}

export class PublicController {
  static async getAvailableProperties(req: Request, res: Response) {
    try {
      const result = await PublicService.getAvailableProperties(listParams(req));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).json(ApiResponse.success(result, 'Imóveis disponíveis recuperados com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao buscar imóveis disponíveis'));
    }
  }

  static async getProperties(req: Request, res: Response) {
    try {
      const result = await PublicService.getProperties(listParams(req));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).json(ApiResponse.success(result, 'Imóveis recuperados com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao buscar imóveis'));
    }
  }

  static async getPropertyById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID do imóvel é obrigatório'));

      const property = await PublicService.getPropertyById(id);
      if (!property) return res.status(404).json(ApiResponse.error('Imóvel não encontrado'));

      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).json(ApiResponse.success(property, 'Imóvel recuperado com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao buscar imóvel'));
    }
  }

  static async getOwners(req: Request, res: Response) {
    try {
      const result = await PublicService.getOwners(listParams(req));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).json(ApiResponse.success(result, 'Proprietários recuperados com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao buscar proprietários'));
    }
  }

  static async getPropertyTypes(req: Request, res: Response) {
    try {
      const result = await PublicService.getPropertyTypes(listParams(req));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).json(ApiResponse.success(result, 'Tipos de imóveis recuperados com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao buscar tipos de imóveis'));
    }
  }

  static async getAgencies(req: Request, res: Response) {
    try {
      const result = await PublicService.getAgencies(listParams(req));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).json(ApiResponse.success(result, 'Imobiliárias recuperadas com sucesso'));
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro ao buscar imobiliárias'));
    }
  }
}
