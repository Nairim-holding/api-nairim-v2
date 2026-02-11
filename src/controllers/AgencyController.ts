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
      
      console.log('📥 Query params recebidos para agências:', req.query);
      
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

      console.log('🔍 Sort options extraídos:', sortOptions);
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
      console.error('Error getting agencies:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getAgencyById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const agency = await AgencyService.getAgencyById(id);

      res.status(200).json(
        ApiResponse.success(agency, 'Agency retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'Agency not found' || error.message === 'Agency not found or deleted') {
        return res.status(404).json(ApiResponse.error('Agency not found'));
      }
      console.error('Error getting agency:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createAgency(req: Request, res: Response) {
    try {
      const validation = AgencyValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const agency = await AgencyService.createAgency(req.body);

      res.status(201).json(
        ApiResponse.success(agency, `Agency ${agency.legal_name} created successfully`)
      );
    } catch (error: any) {
      console.error('Error creating agency:', error);

      if (error.message === 'CNPJ already registered' || error.message === 'CNPJ already exists') {
        return res.status(409).json(ApiResponse.error('CNPJ already registered'));
      }

      res.status(400).json(ApiResponse.error(`Error creating agency: ${error.message}`));
    }
  }

  static async updateAgency(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const validation = AgencyValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const agency = await AgencyService.updateAgency(id, req.body);

      res.status(200).json(
        ApiResponse.success(agency, `Agency ${agency.legal_name} updated successfully`)
      );
    } catch (error: any) {
      console.error('Error updating agency:', error);

      if (error.message === 'Agency not found') {
        return res.status(404).json(ApiResponse.error('Agency not found'));
      }

      if (error.message === 'CNPJ already registered for another agency' || error.message === 'CNPJ already used by another agency') {
        return res.status(409).json(ApiResponse.error('CNPJ already registered for another agency'));
      }

      res.status(400).json(ApiResponse.error(`Error updating agency: ${error.message}`));
    }
  }

  static async deleteAgency(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const agency = await AgencyService.deleteAgency(id);

      res.status(200).json(
        ApiResponse.success(null, `Agency ${agency.legal_name} marked as deleted successfully (soft delete)`)
      );
    } catch (error: any) {
      console.error('Error deleting agency:', error);

      if (error.message === 'Agency not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Agency not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting agency'));
    }
  }

  static async getAgencyFilters(req: Request, res: Response) {
    try {
      // Extrair filtros dos query params para contexto
      const filters: Record<string, any> = {};
      
      console.log('📥 Received query params for agency filters:', req.query);

      // Processar parâmetros de filtro
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          console.log(`🔧 Processing filter param: ${key} =`, value);
          
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

      console.log('📋 Parsed filters for context:', filters);

      const filtersData = await AgencyService.getAgencyFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('❌ Error getting agency filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  // Método opcional para restaurar agência
  static async restoreAgency(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const agency = await AgencyService.restoreAgency(id);

      res.status(200).json(
        ApiResponse.success(null, `Agency ${agency.legal_name} restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring agency:', error);

      if (error.message === 'Agency not found') {
        return res.status(404).json(ApiResponse.error('Agency not found'));
      }

      if (error.message === 'Agency is not deleted') {
        return res.status(400).json(ApiResponse.error('Agency is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring agency'));
    }
  }

  static async getContactSuggestions(req: Request, res: Response) {
    try {
      const search = ValidationUtil.parseStringParam(req.query?.search);
      
      const suggestions = await AgencyService.getAvailableContacts(search);

      // Cache curto
      res.setHeader('Cache-Control', 'public, max-age=30'); 
      
      res.status(200).json(
        ApiResponse.success(suggestions, 'Contact suggestions retrieved successfully')
      );
    } catch (error: any) {
      console.error('Error getting contact suggestions:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}