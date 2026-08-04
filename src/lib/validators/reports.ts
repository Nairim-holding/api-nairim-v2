import { validateDashboardParams } from './dashboard';

export const REPORT_GROUP_BY = [
  'description',
  'day',
  'category',
  'subcategory',
  'contact',
  'center',
] as const;

export type ReportGroupBy = (typeof REPORT_GROUP_BY)[number];

export const DFC_GROUP_BY = ['day', 'subcategory'] as const;
export type DfcGroupBy = (typeof DFC_GROUP_BY)[number];

export const REPORT_REGIMES = ['caixa', 'competencia'] as const;
export type ReportRegime = (typeof REPORT_REGIMES)[number];

export const REPORT_STATUSES = ['PENDING', 'COMPLETED'] as const;
export const REPORT_TYPES = ['INCOME', 'EXPENSE'] as const;

/**
 * Valida os parâmetros comuns dos relatórios financeiros.
 * Reaproveita as regras de período do dashboard (startDate/endDate
 * obrigatórios, YYYY-MM-DD, start ≤ end, máx 365 dias).
 */
export const validateReportParams = (params: any): { isValid: boolean; errors: string[] } => {
  const { errors } = validateDashboardParams(params);

  if (params.regime && !REPORT_REGIMES.includes(params.regime)) {
    errors.push(`regime deve ser um dos valores: ${REPORT_REGIMES.join(', ')}`);
  }

  if (params.status && params.status !== 'all' && !REPORT_STATUSES.includes(params.status)) {
    errors.push(`status deve ser um dos valores: ${REPORT_STATUSES.join(', ')}`);
  }

  if (params.type && !REPORT_TYPES.includes(params.type)) {
    errors.push(`type deve ser um dos valores: ${REPORT_TYPES.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateGroupByParam = (groupBy: any): { isValid: boolean; errors: string[] } => {
  if (!groupBy) {
    return { isValid: false, errors: ['groupBy é obrigatório'] };
  }
  if (!REPORT_GROUP_BY.includes(groupBy)) {
    return {
      isValid: false,
      errors: [`groupBy deve ser um dos valores: ${REPORT_GROUP_BY.join(', ')}`],
    };
  }
  return { isValid: true, errors: [] };
};

/** groupBy do Demonstrativo (DFC) — aceita apenas 'day' ou 'subcategory'; default 'day'. */
export const validateDfcGroupByParam = (groupBy: any): { isValid: boolean; errors: string[] } => {
  if (!groupBy) return { isValid: true, errors: [] };
  if (!DFC_GROUP_BY.includes(groupBy)) {
    return { isValid: false, errors: [`groupBy deve ser um dos valores: ${DFC_GROUP_BY.join(', ')}`] };
  }
  return { isValid: true, errors: [] };
};
