import { Request, Response } from 'express';
import { ReportService, ReportParams } from '../services/ReportService';
import { ApiResponse } from '../utils/api-response';
import {
  validateReportParams,
  validateGroupByParam,
  validateDfcGroupByParam,
  type ReportGroupBy,
  type ReportRegime,
  type DfcGroupBy,
} from '../lib/validators/reports';

// Campos de FK com multi-seleção (chave repetida ou valores separados por vírgula).
const MULTI_SELECT_FIELDS = [
  'financial_institution_id',
  'card_id',
  'category_id',
  'subcategory_id',
  'center_id',
  'supplier_id',
];

export class ReportController {
  /**
   * Extrai os parâmetros comuns dos relatórios da query string.
   * Multi-seleção chega como chave repetida (array) ou vírgula
   * (ex: category_id=a,b), aceita também o padrão filter[campo].
   */
  private static parseReportParams(req: Request): { params?: ReportParams; errors: string[] } {
    const query = req.query || {};

    const startDate = typeof query.startDate === 'string' ? query.startDate : undefined;
    const endDate = typeof query.endDate === 'string' ? query.endDate : undefined;
    const regime = typeof query.regime === 'string' ? query.regime : undefined;
    const status = typeof query.status === 'string' && query.status !== 'all' ? query.status : undefined;
    const type = typeof query.type === 'string' ? query.type : undefined;

    const validation = validateReportParams({ startDate, endDate, regime, status, type });
    if (!validation.isValid) return { errors: validation.errors };

    const filters: Record<string, string[]> = {};

    const addValues = (field: string, raw: unknown) => {
      const values = (Array.isArray(raw) ? raw : [raw])
        .filter((v): v is string => typeof v === 'string')
        .flatMap((v) => v.split(','))
        .map((v) => v.trim())
        .filter((v) => v !== '');
      if (values.length > 0) filters[field] = [...(filters[field] ?? []), ...values];
    };

    Object.entries(query).forEach(([key, value]) => {
      const filterMatch = key.match(/^filter\[(.+)\]$/);
      const field = filterMatch ? filterMatch[1] : key;
      if (MULTI_SELECT_FIELDS.includes(field)) addValues(field, value);
    });

    return {
      params: {
        startDate: startDate!,
        endDate: endDate!,
        regime: (regime as ReportRegime) ?? 'caixa',
        status: status as ReportParams['status'],
        type: type as ReportParams['type'],
        filters,
      },
      errors: [],
    };
  }

  static async getGrouped(req: Request, res: Response) {
    try {
      const { params, errors } = ReportController.parseReportParams(req);
      if (!params) return res.status(400).json(ApiResponse.error('Parâmetros inválidos', errors));

      const groupByValidation = validateGroupByParam(req.query?.groupBy);
      if (!groupByValidation.isValid) {
        return res.status(400).json(ApiResponse.error('Parâmetros inválidos', groupByValidation.errors));
      }

      const data = await ReportService.getGroupedReport(params, req.query.groupBy as ReportGroupBy);
      res.status(200).json(ApiResponse.success(data, 'Relatório agrupado gerado com sucesso'));
    } catch (error: any) {
      console.error('Error getting grouped report:', error);
      res.status(500).json(ApiResponse.error('Erro ao gerar relatório agrupado'));
    }
  }

  static async getExtrato(req: Request, res: Response) {
    try {
      const { params, errors } = ReportController.parseReportParams(req);
      if (!params) return res.status(400).json(ApiResponse.error('Parâmetros inválidos', errors));

      const data = await ReportService.getExtratoReport(params);
      res.status(200).json(ApiResponse.success(data, 'Extrato gerado com sucesso'));
    } catch (error: any) {
      console.error('Error getting statement report:', error);
      res.status(500).json(ApiResponse.error('Erro ao gerar extrato'));
    }
  }

  static async getIncomeExpense(req: Request, res: Response) {
    try {
      const { params, errors } = ReportController.parseReportParams(req);
      if (!params) return res.status(400).json(ApiResponse.error('Parâmetros inválidos', errors));

      const data = await ReportService.getIncomeExpenseReport(params);
      res.status(200).json(ApiResponse.success(data, 'Relatório de receitas e despesas gerado com sucesso'));
    } catch (error: any) {
      console.error('Error getting income/expense report:', error);
      res.status(500).json(ApiResponse.error('Erro ao gerar relatório de receitas e despesas'));
    }
  }

  static async getDemonstrativo(req: Request, res: Response) {
    try {
      const { params, errors } = ReportController.parseReportParams(req);
      if (!params) return res.status(400).json(ApiResponse.error('Parâmetros inválidos', errors));

      const groupByValidation = validateDfcGroupByParam(req.query?.groupBy);
      if (!groupByValidation.isValid) {
        return res.status(400).json(ApiResponse.error('Parâmetros inválidos', groupByValidation.errors));
      }

      const groupBy = (req.query.groupBy as DfcGroupBy) ?? 'day';
      const data = await ReportService.getDemonstrativoReport(params, groupBy);
      res.status(200).json(ApiResponse.success(data, 'Demonstrativo gerado com sucesso'));
    } catch (error: any) {
      console.error('Error getting DFC report:', error);
      res.status(500).json(ApiResponse.error('Erro ao gerar demonstrativo'));
    }
  }
}
