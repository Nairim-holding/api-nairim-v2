import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { TenantValidator } from '../lib/validators/tenant';
import { TenantService } from '@/services/TenantService';

export class TenantController {
  static async getTenants(req: Request, res: Response) {
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
            const field = sortMatch[1];
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') {
              sortOptions[field] = direction;
            }
          }
          else if (!['limit', 'page', 'search', 'includeInactive'].includes(key) && value.trim() !== '') {
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

      const result = await TenantService.getTenants({
        limit,
        page,
        search,
        filters,
        sortOptions,
        includeInactive,
      });

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.status(200).json(result);

    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getTenantById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID é obrigatório'));
      }
      
      const tenant = await TenantService.getTenantById(id);

      res.status(200).json(
        ApiResponse.success(tenant, 'Inquilino recuperado com sucesso')
      );
    } catch (error: any) {
      if (error.message === 'Tenant not found') {
        return res.status(404).json(ApiResponse.error('Inquilino não encontrado'));
      }
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async createTenant(req: Request, res: Response) {
    try {
      const validation = TenantValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const tenant = await TenantService.createTenant(req.body);

      res.status(201).json(
        ApiResponse.success(tenant, `Inquilino ${tenant.name} criado com sucesso`)
      );
    } catch (error: any) {
      if (error.message === 'Internal code already registered') {
        return res.status(409).json(ApiResponse.error('O Código Interno informado já está em uso por outro inquilino'));
      }

      if (error.message === 'CPF already registered') {
        return res.status(409).json(ApiResponse.error('O CPF informado já está cadastrado'));
      }
      
      if (error.message === 'CNPJ already registered') {
        return res.status(409).json(ApiResponse.error('O CNPJ informado já está cadastrado'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao criar inquilino: ${error.message}`));
    }
  }

  static async updateTenant(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID é obrigatório'));
      }

      const validation = TenantValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const tenant = await TenantService.updateTenant(id, req.body);

      res.status(200).json(
        ApiResponse.success(tenant, `Inquilino ${tenant.name} atualizado com sucesso`)
      );
    } catch (error: any) {
      if (error.message === 'Internal code already registered for another tenant') {
        return res.status(409).json(ApiResponse.error('O Código Interno informado já está em uso por outro inquilino'));
      }

      if (error.message === 'Tenant not found') {
        return res.status(404).json(ApiResponse.error('Inquilino não encontrado'));
      }

      if (error.message === 'CPF already registered for another tenant') {
        return res.status(409).json(ApiResponse.error('O CPF informado já está cadastrado para outro inquilino'));
      }

      if (error.message === 'CNPJ already registered for another tenant') {
        return res.status(409).json(ApiResponse.error('O CNPJ informado já está cadastrado para outro inquilino'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao atualizar inquilino: ${error.message}`));
    }
  }

  static async deleteTenant(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID é obrigatório'));
      }

      const tenant = await TenantService.deleteTenant(id);

      res.status(200).json(
        ApiResponse.success(null, `Inquilino ${tenant.name} marcado como excluído com sucesso`)
      );
    } catch (error: any) {
      if (error.message === 'Tenant not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Inquilino não encontrado ou já excluído'));
      }

      res.status(500).json(ApiResponse.error('Erro ao excluir inquilino'));
    }
  }

  static async restoreTenant(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID é obrigatório'));
      }

      const tenant = await TenantService.restoreTenant(id);

      res.status(200).json(
        ApiResponse.success(null, `Inquilino ${tenant.name} restaurado com sucesso`)
      );
    } catch (error: any) {
      if (error.message === 'Tenant not found') {
        return res.status(404).json(ApiResponse.error('Inquilino não encontrado'));
      }

      if (error.message === 'Tenant is not deleted') {
        return res.status(400).json(ApiResponse.error('O inquilino não está excluído'));
      }

      res.status(500).json(ApiResponse.error('Erro ao restaurar inquilino'));
    }
  }

  static async getTenantFilters(req: Request, res: Response) {
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

      const filtersData = await TenantService.getTenantFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filtros recuperados com sucesso')
      );
    } catch (error) {
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getContactSuggestions(req: Request, res: Response) {
    try {
      const search = ValidationUtil.parseStringParam(req.query?.search);
      
      const suggestions = await TenantService.getAvailableContacts(search);

      res.setHeader('Cache-Control', 'public, max-age=30'); 
      
      res.status(200).json(
        ApiResponse.success(suggestions, 'Sugestões de contatos recuperadas com sucesso')
      );
    } catch (error: any) {
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }
}