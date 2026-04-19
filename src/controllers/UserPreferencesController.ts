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
            columnWidths: {}
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

      const preferences = await UserPreferencesService.saveColumnPreferences(userId, {
        resource: req.body.resource,
        columnOrder: req.body.columnOrder,
        columnWidths: req.body.columnWidths
      });

      res.status(200).json(
        ApiResponse.success(preferences, 'Preferências salvas com sucesso')
      );
    } catch (error: any) {
      console.error('Erro ao salvar preferências de colunas:', error);
      res.status(500).json(ApiResponse.error('Erro ao salvar preferências'));
    }
  }
}
