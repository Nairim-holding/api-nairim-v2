import { Request, Response } from 'express';
import { AgencyService } from '../services/AgencyService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { AgencyValidator } from '../lib/validators/agency';

export class AgencyController {
  static async getAgencies(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 30);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      // Processar sort no formato sort[field]=direction
      const sortOptions: Record<string, 'asc' | 'desc'> = {};
      const filters: Record<string, any> = {};
      
      console.log('📥 Query params recebidos para imobiliárias:', req.query);
      
      // Processar parâmetros de ordenação
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (typeof value === 'string') {
          // Verificar se é parâmetro de ordenação no formato sort[field]
          const sortMatch = key.match(/^sort\[(.+)\]$/);
          if (sortMatch) {
            const field = sortMatch[1];
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') {
              sortOptions[field] = direction;
              console.log(`📌 Ordenação detectada: ${field} -> ${direction}`);
            }
          }
          // Processar filtros
          else if (!['limit', 'page', 'search', 'includeInactive'].includes(key) && value.trim() !== '') {
            // Verificar se é filtro no formato filter[field]
            const filterMatch = key.match(/^filter\[(.+)\]$/);
            if (filterMatch) {
              const field = filterMatch[1];
              filters[field] = value;
            }
            // Tratar outros parâmetros como filtros diretos
            else if (key !== 'sort' && !key.startsWith('sort[')) {
              try {
                const parsedValue = JSON.parse(value);
                filters[key] = parsedValue;
              } catch {
                filters[key] = value;
              }
            }
          }
        }
      });

      console.log('🔍 Opções de ordenação extraídas:', sortOptions);
      console.log('📋 Filtros extraídos:', filters);

      const params = {
        limit,
        page,
        search,
        filters,
        sortOptions,
        includeInactive,
      };

      const result = await AgencyService.getAgencies(params);

      // Desabilitar cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.status(200).json(result);

    } catch (error: any) {
      console.error('Erro ao buscar imobiliárias:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getAgencyById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }
      
      const agency = await AgencyService.getAgencyById(id);

      res.status(200).json(
        ApiResponse.success(agency, 'Imobiliária recuperada com sucesso')
      );
    } catch (error: any) {
      if (error.message === 'Agency not found' || error.message === 'Imobiliária não encontrada') {
        return res.status(404).json(ApiResponse.error('Imobiliária não encontrada'));
      }
      console.error('Erro ao buscar imobiliária:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async createAgency(req: Request, res: Response) {
    try {
      const validation = AgencyValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const agency = await AgencyService.createAgency(req.body);

      res.status(201).json(
        ApiResponse.success(agency, `Imobiliária ${agency.legal_name} criada com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao criar imobiliária:', error);

      if (error.message === 'CNPJ already registered' || error.message === 'CNPJ já cadastrado') {
        return res.status(409).json(ApiResponse.error('CNPJ já cadastrado'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao criar imobiliária: ${error.message}`));
    }
  }

  static async updateAgency(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const validation = AgencyValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const agency = await AgencyService.updateAgency(id, req.body);

      res.status(200).json(
        ApiResponse.success(agency, `Imobiliária ${agency.legal_name} atualizada com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao atualizar imobiliária:', error);

      if (error.message === 'Agency not found' || error.message === 'Imobiliária não encontrada') {
        return res.status(404).json(ApiResponse.error('Imobiliária não encontrada'));
      }

      if (error.message === 'CNPJ already registered for another agency' || error.message === 'CNPJ já cadastrado para outra imobiliária') {
        return res.status(409).json(ApiResponse.error('CNPJ já cadastrado para outra imobiliária'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao atualizar imobiliária: ${error.message}`));
    }
  }

  static async deleteAgency(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const agency = await AgencyService.deleteAgency(id);

      res.status(200).json(
        ApiResponse.success(null, `Imobiliária ${agency.legal_name} marcada como excluída com sucesso (soft delete)`)
      );
    } catch (error: any) {
      console.error('Erro ao excluir imobiliária:', error);

      if (error.message === 'Agency not found or already deleted' || error.message === 'Imobiliária não encontrada ou já excluída') {
        return res.status(404).json(ApiResponse.error('Imobiliária não encontrada ou já excluída'));
      }

      res.status(500).json(ApiResponse.error('Erro ao excluir imobiliária'));
    }
  }

  static async getAgencyFilters(req: Request, res: Response) {
    try {
      // Extrair filtros dos query params para contexto
      const filters: Record<string, any> = {};
      
      console.log('📥 Query params recebidos para filtros de imobiliárias:', req.query);

      // Processar parâmetros de filtro
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          console.log(`🔧 Processando parâmetro de filtro: ${key} =`, value);
          
          try {
            const parsedValue = JSON.parse(value as string);
            if (parsedValue && typeof parsedValue === 'object') {
              filters[key] = parsedValue;
            } else {
              filters[key] = value;
            }
          } catch {
            filters[key] = value;
          }
        }
      });

      console.log('📋 Filtros processados para o contexto:', filters);

      const filtersData = await AgencyService.getAgencyFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filtros recuperados com sucesso')
      );
    } catch (error) {
      console.error('❌ Erro ao buscar filtros de imobiliárias:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  // Método opcional para restaurar imobiliária
  static async restoreAgency(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const agency = await AgencyService.restoreAgency(id);

      res.status(200).json(
        ApiResponse.success(null, `Imobiliária ${agency.legal_name} restaurada com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao restaurar imobiliária:', error);

      if (error.message === 'Agency not found' || error.message === 'Imobiliária não encontrada') {
        return res.status(404).json(ApiResponse.error('Imobiliária não encontrada'));
      }

      if (error.message === 'Agency is not deleted' || error.message === 'A imobiliária não está excluída') {
        return res.status(400).json(ApiResponse.error('A imobiliária não está excluída'));
      }

      res.status(500).json(ApiResponse.error('Erro ao restaurar imobiliária'));
    }
  }

  static async getContactSuggestions(req: Request, res: Response) {
    try {
      const search = ValidationUtil.parseStringParam(req.query?.search);
      
      const suggestions = await AgencyService.getAvailableContacts(search);

      // Cache curto
      res.setHeader('Cache-Control', 'public, max-age=30'); 
      
      res.status(200).json(
        ApiResponse.success(suggestions, 'Sugestões de contato recuperadas com sucesso')
      );
    } catch (error: any) {
      console.error('Erro ao buscar sugestões de contato:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }
}