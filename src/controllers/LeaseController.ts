import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { GetLeasesParams } from '../types/lease';
import { LeaseValidator } from '@/lib/validators/lease';
import { LeaseService } from '@/services/LeaseService';

export class LeaseController {
  static async getLeases(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);

      const sortOptions: Record<string, 'asc' | 'desc'> = {};
      const filters: Record<string, any> = {};
      
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (typeof value === 'string') {
          const sortMatch = key.match(/^sort\[(.+)\]$/);
          if (sortMatch) {
            const field = sortMatch[1];
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') {
              sortOptions[field] = direction;
            }
          }
          else if (!['limit', 'page', 'search'].includes(key) && value.trim() !== '') {
            const filterMatch = key.match(/^filter\[(.+)\]$/);
            if (filterMatch) {
              const field = filterMatch[1];
              filters[field] = value;
            }
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

      const normalizedSortOptions: Record<string, 'asc' | 'desc'> = {};
      Object.entries(sortOptions).forEach(([field, direction]) => {
        const fieldMap: Record<string, string> = {
          'property_title': 'property.title',
          'type_description': 'property.type.description',
          'owner_name': 'owner.name',
          'tenant_name': 'tenant.name',
        };
        
        normalizedSortOptions[fieldMap[field] || field] = direction;
      });

      const params: GetLeasesParams = {
        limit,
        page,
        search,
        filters,
        sortOptions: normalizedSortOptions,
      };

      const validation = LeaseValidator.validateQueryParams({ ...req.query, ...normalizedSortOptions });
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const result = await LeaseService.getLeases(params);

      // Configuração de headers para evitar cache de dados dinâmicos
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.status(200).json(result);

    } catch (error: any) {
      console.error('Erro ao buscar locações:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getLeaseById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }
      
      const lease = await LeaseService.getLeaseById(id);

      res.status(200).json(
        ApiResponse.success(lease, 'Locação recuperada com sucesso')
      );
    } catch (error: any) {
      if (error.message === 'Lease not found' || error.message === 'Locação não encontrada') {
        return res.status(404).json(ApiResponse.error('Locação não encontrada'));
      }
      console.error('Erro ao buscar locação por ID:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async createLease(req: Request, res: Response) {
    try {
      const validation = LeaseValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const lease = await LeaseService.createLease(req.body);

      const response = ApiResponse.success(lease, `Locação ${lease.contract_number} criada com sucesso`);
      res.status(201).json(
        validation.warnings.length > 0 ? { ...response, warnings: validation.warnings } : response
      );
    } catch (error: any) {
      console.error('Erro ao criar locação:', error);

      if (error.message === 'Contract number already registered' || error.message === 'Número de contrato já registrado') {
        return res.status(409).json(ApiResponse.error('Este número de contrato já está registrado'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao criar locação: ${error.message}`));
    }
  }

  static async updateLease(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const validation = LeaseValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const lease = await LeaseService.updateLease(id, req.body);

      const response = ApiResponse.success(lease, `Locação ${lease.contract_number} atualizada com sucesso`);
      res.status(200).json(
        validation.warnings.length > 0 ? { ...response, warnings: validation.warnings } : response
      );
    } catch (error: any) {
      console.error('Erro ao atualizar locação:', error);

      if (error.message === 'Lease not found' || error.message === 'Locação não encontrada') {
        return res.status(404).json(ApiResponse.error('Locação não encontrada'));
      }

      if (error.message === 'Contract number already registered for another lease' || error.message === 'Número de contrato já registrado para outra locação') {
        return res.status(409).json(ApiResponse.error('Número de contrato já registrado para outra locação'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao atualizar locação: ${error.message}`));
    }
  }

  static async deleteLease(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const lease = await LeaseService.deleteLease(id);

      res.status(200).json(
        ApiResponse.success(null, `Locação ${lease.contract_number} cancelada com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao cancelar locação:', error);

      if (error.message === 'Lease not found' || error.message === 'Locação não encontrada') {
        return res.status(404).json(ApiResponse.error('Locação não encontrada'));
      }

      if (error.message === 'Lease already canceled' || error.message === 'Locação já se encontra cancelada') {
        return res.status(400).json(ApiResponse.error('Esta locação já se encontra cancelada'));
      }

      res.status(500).json(ApiResponse.error('Erro ao cancelar locação'));
    }
  }

  static async restoreLease(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const lease = await LeaseService.restoreLease(id);

      res.status(200).json(
        ApiResponse.success(null, `Locação ${lease.contract_number} restaurada com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao restaurar locação:', error);

      if (error.message === 'Lease not found' || error.message === 'Locação não encontrada') {
        return res.status(404).json(ApiResponse.error('Locação não encontrada'));
      }

      res.status(500).json(ApiResponse.error('Erro ao restaurar locação'));
    }
  }

  static async getLeaseFilters(req: Request, res: Response) {
    try {
      const filters: Record<string, any> = {};
      
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
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

      const filtersData = await LeaseService.getLeaseFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filtros recuperados com sucesso')
      );
    } catch (error) {
      console.error('Erro ao recuperar filtros de locação:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }
}