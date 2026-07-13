import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { UserPreferencesService } from '../services/UserPreferencesService';
import { ApiResponse } from '../utils/api-response';

export class UserPreferencesController {
  static async getColumnOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(ApiResponse.error('Usuário não autenticado'));
      }

      const resource = String(req.query.resource);

      const preferences = await UserPreferencesService.getColumnPreferences(userId, resource);

      if (!preferences) {
        return res.status(404).json({
          success: false,
          message: 'Preferências não encontradas para este recurso',
          data: {
            columnOrder: [],
            columnWidths: {},
            visibleColumns: []
          }
        });
      }

      res.status(200).json(
        ApiResponse.success(preferences, 'Preferências recuperadas com sucesso')
      );
    } catch (error: any) {
      console.error('Erro ao buscar preferências de colunas:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async saveColumnOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(ApiResponse.error('Usuário não autenticado'));
      }

      const company_id = (req as any).user?.company_id ?? '';
      const preferences = await UserPreferencesService.saveColumnPreferences(userId, {
        resource: req.body.resource,
        columnOrder: req.body.columnOrder,
        columnWidths: req.body.columnWidths,
        visibleColumns: req.body.visibleColumns
      }, company_id);

      res.status(200).json(
        ApiResponse.success(preferences, 'Preferências salvas com sucesso')
      );
    } catch (error: any) {
      console.error('Erro ao salvar preferências de colunas:', error);
      res.status(500).json(ApiResponse.error('Erro ao salvar preferências'));
    }
  }

  static async getDashboardLayout(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(ApiResponse.error('Usuário não autenticado'));
      }

      const resource = String(req.query.resource);

      const layout = await UserPreferencesService.getDashboardLayout(userId, resource);

      if (!layout) {
        return res.status(404).json({
          success: false,
          message: 'Layout não encontrado para este recurso',
          data: { layout: [] }
        });
      }

      res.status(200).json(
        ApiResponse.success(layout, 'Layout recuperado com sucesso')
      );
    } catch (error: any) {
      console.error('Erro ao buscar layout do dashboard:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async saveDashboardLayout(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(ApiResponse.error('Usuário não autenticado'));
      }

      const company_id = (req as any).user?.company_id ?? '';
      const layout = await UserPreferencesService.saveDashboardLayout(userId, {
        resource: req.body.resource,
        layout: req.body.layout
      }, company_id);

      res.status(200).json(
        ApiResponse.success(layout, 'Layout salvo com sucesso')
      );
    } catch (error: any) {
      console.error('Erro ao salvar layout do dashboard:', error);
      res.status(500).json(ApiResponse.error('Erro ao salvar layout'));
    }
  }
}
