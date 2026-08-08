import { Request, Response } from 'express';
import { AuditService } from '../services/AuditService';
import { ApiResponse } from '../utils/api-response';

export class AuditController {
  static async getIptuSettings(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      const settings = await AuditService.getIptuAuditSettings(company_id);
      res.status(200).json(ApiResponse.success(settings, 'Configuração de Auditoria de IPTU recuperada com sucesso'));
    } catch (error: any) {
      console.error('Error getting IPTU audit settings:', error);
      res.status(500).json(ApiResponse.error('Erro ao buscar configuração de Auditoria de IPTU'));
    }
  }

  static async saveIptuSettings(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      const settings = await AuditService.saveIptuAuditSettings(company_id, req.body || {});
      res.status(200).json(ApiResponse.success(settings, 'Configuração de Auditoria de IPTU salva com sucesso'));
    } catch (error: any) {
      console.error('Error saving IPTU audit settings:', error);
      res.status(500).json(ApiResponse.error('Erro ao salvar configuração de Auditoria de IPTU'));
    }
  }

  static async getIptuAudit(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json(ApiResponse.error('startDate e endDate são obrigatórios'));
      }

      const { company_id } = (req as any).user;
      const data = await AuditService.getIptuAudit(
        { startDate: String(startDate), endDate: String(endDate) },
        company_id
      );
      res.status(200).json(ApiResponse.success(data, 'Auditoria de IPTU gerada com sucesso'));
    } catch (error: any) {
      if (error.message?.startsWith('Configure as categorias')) {
        return res.status(400).json(ApiResponse.error(error.message));
      }
      console.error('Error getting IPTU audit:', error);
      res.status(500).json(ApiResponse.error('Erro ao gerar Auditoria de IPTU'));
    }
  }
}
