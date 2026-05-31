import { Request, Response, NextFunction } from 'express';
import { PlanningService } from '../services/PlanningService';
import { ApiResponse } from '../utils/api-response';

export class PlanningController {
  static async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { company_id } = (req as any).user;
      const data = await PlanningService.upsertPlanning(req.body, company_id);
      res.status(200).json(ApiResponse.success(data, 'Planejamento salvo com sucesso'));
    } catch (error: any) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const year = Number(req.query.year);
      const data = await PlanningService.getPlannings(year);
      res.status(200).json(ApiResponse.success(data, 'Planejamentos recuperados com sucesso'));
    } catch (error: any) {
      next(error);
    }
  }

  static async listByYear(req: Request, res: Response, next: NextFunction) {
    try {
      const year = Number(req.query.year);
      const data = await PlanningService.getPlannings(year);
      res.status(200).json(ApiResponse.success(data, 'Planejamentos recuperados com sucesso'));
    } catch (error: any) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      const data = await PlanningService.getPlanningById(id);
      res.status(200).json(ApiResponse.success(data, 'Planejamento recuperado com sucesso'));
    } catch (error: any) {
      if (error.message === 'Planning not found') {
        return res.status(404).json(ApiResponse.error('Planejamento não encontrado'));
      }
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('O ID é obrigatório'));

      await PlanningService.deletePlanning(id);
      res.status(200).json(ApiResponse.success(null, 'Planejamento removido com sucesso'));
    } catch (error: any) {
      if (error.message === 'Planning not found') {
        return res.status(404).json(ApiResponse.error('Planejamento não encontrado'));
      }
      next(error);
    }
  }

  static async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = String(req.query.startDate || '');
      const endDate = String(req.query.endDate || '');

      if (!startDate || !endDate) {
        return res
          .status(400)
          .json(ApiResponse.error('startDate e endDate são obrigatórios (YYYY-MM-DD)'));
      }

      const data = await PlanningService.getPlanningDashboard(startDate, endDate);
      res
        .status(200)
        .json(ApiResponse.success(data, 'Dashboard de planejamento recuperado com sucesso'));
    } catch (error: any) {
      if (error.message.includes('Invalid date format')) {
        return res.status(400).json(ApiResponse.error(error.message));
      }
      next(error);
    }
  }
}
