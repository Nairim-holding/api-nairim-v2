// controllers/AuditLogController.ts
import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { AuditLogValidator } from '../lib/validators/audit-log';
import { AuditLogService } from '@/services/AuditLogService';

export class AuditLogController {
  static async getAuditLogById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const log = await AuditLogService.getAuditLogById(id);

      res.status(200).json(ApiResponse.success(log, 'Log recuperado com sucesso'));
    } catch (error: any) {
      if (error.message === 'Audit log not found') {
        return res.status(404).json(ApiResponse.error('Log não encontrado'));
      }
      console.error('Erro ao buscar log de auditoria:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getAuditLogs(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 30);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);

      const sortOptions: any = {};
      const filters: Record<string, any> = {};

      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (key.startsWith('sort[') && key.endsWith(']')) {
          const field = key.substring(5, key.length - 1);
          const direction = String(value).toLowerCase();
          if (direction === 'asc' || direction === 'desc') {
            sortOptions[field] = direction;
          }
        } else if (
          !['limit', 'page', 'search'].includes(key) &&
          !key.startsWith('sort')
        ) {
          if (key.startsWith('filter[')) {
            const filterField = key.substring(7, key.length - 1);
            if (value && value !== '' && value !== 'undefined' && value !== 'null') {
              filters[filterField] = value;
            }
          } else if (value && value !== '' && value !== 'undefined' && value !== 'null') {
            try {
              if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                const parsed = JSON.parse(value);
                filters[key] = parsed && typeof parsed === 'object' ? parsed : value;
              } else {
                filters[key] = value;
              }
            } catch {
              filters[key] = value;
            }
          }
        }
      });

      const validation = AuditLogValidator.validateQueryParams({ ...req.query, ...sortOptions });
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const result = await AuditLogService.getAuditLogs({ limit, page, search, filters, sortOptions });

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Erro ao buscar logs de auditoria:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getAuditLogFilters(req: Request, res: Response) {
    try {
      const filters: Record<string, any> = {};

      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          try {
            const parsed = JSON.parse(value as string);
            filters[key] = parsed && typeof parsed === 'object' ? parsed : value;
          } catch {
            filters[key] = value;
          }
        }
      });

      const filtersData = await AuditLogService.getAuditLogFilters(filters);

      res.status(200).json(ApiResponse.success(filtersData, 'Filtros recuperados com sucesso'));
    } catch (error) {
      console.error('❌ Erro ao buscar filtros de auditoria:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }
}
