import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { LeaseValidator } from '../lib/validators/lease';
import { LeaseService } from '@/services/LeaseService';
import { GetLeasesParams } from '../types/lease';

export class LeaseController {
  static async getLeases(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      // Processar sort no formato sort[field]=direction
      const sortOptions: Record<string, 'asc' | 'desc'> = {};
      const filters: Record<string, any> = {};
      
      console.log('📥 Query params recebidos para locações:', req.query);
      
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

      // Garantir que campos de relacionamento usem a notação correta
      const normalizedSortOptions: Record<string, 'asc' | 'desc'> = {};
      Object.entries(sortOptions).forEach(([field, direction]) => {
        // Mapear campos do front-end para campos do back-end
        const fieldMap: Record<string, string> = {
          'property_title': 'property.title',
          'type_description': 'property.type.description',
          'owner_name': 'owner.name',
          'tenant_name': 'tenant.name',
        };
        
        normalizedSortOptions[fieldMap[field] || field] = direction;
      });

      console.log('🔍 Sort options normalizados:', normalizedSortOptions);
      console.log('📋 Filtros extraídos:', filters);

      const params: GetLeasesParams = {
        limit,
        page,
        search,
        filters,
        sortOptions: normalizedSortOptions, // Usar os normalizados
        includeInactive,
      };

      const validation = LeaseValidator.validateQueryParams({ ...req.query, ...normalizedSortOptions });
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const result = await LeaseService.getLeases(params);

      // Desabilitar cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting leases:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getLeaseById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const lease = await LeaseService.getLeaseById(id);

      res.status(200).json(
        ApiResponse.success(lease, 'Lease retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'Lease not found') {
        return res.status(404).json(ApiResponse.error('Lease not found'));
      }
      console.error('Error getting lease:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createLease(req: Request, res: Response) {
    try {
      const validation = LeaseValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const lease = await LeaseService.createLease(req.body);

      res.status(201).json(
        ApiResponse.success(lease, `Lease ${lease.contract_number} created successfully`)
      );
    } catch (error: any) {
      console.error('Error creating lease:', error);
      
      if (error.message === 'Contract number already registered') {
        return res.status(409).json(ApiResponse.error('Contract number already registered'));
      }

      res.status(400).json(ApiResponse.error(`Error creating lease: ${error.message}`));
    }
  }

  static async updateLease(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const validation = LeaseValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const lease = await LeaseService.updateLease(id, req.body);

      res.status(200).json(
        ApiResponse.success(lease, `Lease ${lease.contract_number} updated successfully`)
      );
    } catch (error: any) {
      console.error('Error updating lease:', error);

      if (error.message === 'Lease not found') {
        return res.status(404).json(ApiResponse.error('Lease not found'));
      }

      if (error.message === 'Contract number already registered for another lease') {
        return res.status(409).json(ApiResponse.error('Contract number already registered for another lease'));
      }

      res.status(400).json(ApiResponse.error(`Error updating lease: ${error.message}`));
    }
  }

  static async deleteLease(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const lease = await LeaseService.deleteLease(id);

      res.status(200).json(
        ApiResponse.success(null, `Lease ${lease.contract_number} marked as deleted successfully`)
      );
    } catch (error: any) {
      console.error('Error deleting lease:', error);

      if (error.message === 'Lease not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Lease not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting lease'));
    }
  }

  static async restoreLease(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const lease = await LeaseService.restoreLease(id);

      res.status(200).json(
        ApiResponse.success(null, `Lease ${lease.contract_number} restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring lease:', error);

      if (error.message === 'Lease not found') {
        return res.status(404).json(ApiResponse.error('Lease not found'));
      }

      if (error.message === 'Lease is not deleted') {
        return res.status(400).json(ApiResponse.error('Lease is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring lease'));
    }
  }

  static async getLeaseFilters(req: Request, res: Response) {
    try {
      // Extrair filtros dos query params para contexto
      const filters: Record<string, any> = {};
      
      console.log('📥 Received query params for lease filters:', req.query);

      // Processar parâmetros de filtro
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          console.log(`🔧 Processing filter param: ${key} =`, value);
          
          try {
            // Tentar parsear como JSON (para objetos como date ranges)
            const parsedValue = JSON.parse(value as string);
            if (parsedValue && typeof parsedValue === 'object') {
              filters[key] = parsedValue;
            } else {
              filters[key] = value;
            }
          } catch {
            // Se não for JSON, tratar como string
            filters[key] = value;
          }
        }
      });

      console.log('📋 Parsed filters for context:', filters);

      const filtersData = await LeaseService.getLeaseFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('❌ Error getting lease filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}