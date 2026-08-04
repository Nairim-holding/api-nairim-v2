import prisma from '@/lib/prisma';
import { parseLocalDate, formatLocalDate, displayDate } from '../utils/date-utils';
import type { ReportGroupBy, ReportRegime, DfcGroupBy } from '../lib/validators/reports';

export interface ReportParams {
  startDate: string;
  endDate: string;
  regime?: ReportRegime;
  status?: 'PENDING' | 'COMPLETED';
  type?: 'INCOME' | 'EXPENSE';
  /** Filtros multi-seleção já normalizados para array de strings. */
  filters?: Record<string, string[]>;
}

interface ReportItem {
  id: string;
  description: string;
  amount: number;
  event_date: Date;
  effective_date: Date;
  status: string;
  category: { id: string; name: string } | null;
  subcategory: { id: string; name: string } | null;
  financialInstitution: { id: string; name: string } | null;
  card: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  center: { id: string; name: string } | null;
}

interface ReportGroup {
  key: string;
  label: string;
  total: number;
  count: number;
  items: ReportItem[];
}

// Campos de FK que aceitam multi-seleção (IN) nos relatórios.
const MULTI_SELECT_FIELDS = [
  'financial_institution_id',
  'card_id',
  'category_id',
  'subcategory_id',
  'center_id',
  'supplier_id',
];

const INCLUDE_CONFIG = {
  category: { select: { id: true, name: true, type: true } },
  subcategory: { select: { id: true, name: true } },
  financial_institution: { select: { id: true, name: true } },
  card: { select: { id: true, name: true } },
  center: { select: { id: true, name: true } },
  supplier: { select: { id: true, legal_name: true, trade_name: true } },
};

export class ReportService {
  /**
   * Monta o where-base dos relatórios: soft delete, exclusão de
   * transferências, período na data do regime (caixa = effective_date,
   * competencia = event_date), status, tipo (via category.type) e os
   * filtros multi-seleção de FKs.
   */
  private static buildBaseWhere(params: ReportParams): { where: any; dateField: 'effective_date' | 'event_date'; start: Date } {
    const dateField = params.regime === 'competencia' ? 'event_date' : 'effective_date';

    const start = parseLocalDate(params.startDate);
    const end = parseLocalDate(params.endDate);
    end.setHours(23, 59, 59, 999);

    const where: any = {
      deleted_at: null,
      NOT: { is_transfer: true },
      [dateField]: { gte: start, lte: end },
    };

    if (params.status) where.status = params.status;
    if (params.type) where.category = { type: params.type };

    Object.entries(params.filters ?? {}).forEach(([key, values]) => {
      if (!MULTI_SELECT_FIELDS.includes(key)) return;
      const list = (Array.isArray(values) ? values : [values]).filter((v) => typeof v === 'string' && v.trim() !== '');
      if (list.length > 0) where[key] = { in: list };
    });

    return { where, dateField, start };
  }

  private static mapItem(t: any): ReportItem {
    return {
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      event_date: t.event_date,
      effective_date: t.effective_date,
      status: t.status,
      category: t.category ? { id: t.category.id, name: t.category.name } : null,
      subcategory: t.subcategory ? { id: t.subcategory.id, name: t.subcategory.name } : null,
      financialInstitution: t.financial_institution
        ? { id: t.financial_institution.id, name: t.financial_institution.name }
        : null,
      card: t.card ? { id: t.card.id, name: t.card.name } : null,
      supplier: t.supplier
        ? { id: t.supplier.id, name: t.supplier.trade_name ?? t.supplier.legal_name }
        : null,
      center: t.center ? { id: t.center.id, name: t.center.name } : null,
    };
  }

  private static groupKeyOf(t: any, groupBy: ReportGroupBy, dateField: 'effective_date' | 'event_date'): { key: string; label: string } {
    switch (groupBy) {
      case 'day': {
        const key = formatLocalDate(t[dateField]);
        return { key, label: displayDate(t[dateField]) };
      }
      case 'description':
        return { key: t.description, label: t.description };
      case 'category':
        return t.category
          ? { key: t.category.id, label: t.category.name }
          : { key: 'none', label: 'Sem categoria' };
      case 'subcategory':
        return t.subcategory
          ? { key: t.subcategory.id, label: t.subcategory.name }
          : { key: 'none', label: 'Sem subcategoria' };
      case 'contact':
        return t.supplier
          ? { key: t.supplier.id, label: t.supplier.trade_name ?? t.supplier.legal_name }
          : { key: 'none', label: 'Sem contato' };
      case 'center':
        return t.center
          ? { key: t.center.id, label: t.center.name }
          : { key: 'none', label: 'Sem centro' };
    }
  }

  /** Agrupa uma lista de transações, ordenando grupos por total desc e itens por data asc. */
  private static buildGroups(transactions: any[], groupBy: ReportGroupBy, dateField: 'effective_date' | 'event_date'): ReportGroup[] {
    const byKey = new Map<string, ReportGroup>();

    for (const t of transactions) {
      const { key, label } = this.groupKeyOf(t, groupBy, dateField);
      let group = byKey.get(key);
      if (!group) {
        group = { key, label, total: 0, count: 0, items: [] };
        byKey.set(key, group);
      }
      group.total += Number(t.amount);
      group.count += 1;
      group.items.push(this.mapItem(t));
    }

    const groups = Array.from(byKey.values());
    for (const group of groups) {
      group.items.sort((a, b) => {
        const diff = parseLocalDate(a[dateField]).getTime() - parseLocalDate(b[dateField]).getTime();
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      });
    }
    groups.sort((a, b) => b.total - a.total);

    return groups;
  }

  /** GET /financial-reports/grouped */
  static async getGroupedReport(params: ReportParams, groupBy: ReportGroupBy) {
    try {
      const { where, dateField } = this.buildBaseWhere(params);

      const transactions = await prisma.transaction.findMany({
        where,
        include: INCLUDE_CONFIG,
      });

      const groups = this.buildGroups(transactions, groupBy, dateField);
      const totalGeral = groups.reduce((sum, g) => sum + g.total, 0);

      return { groups, totalGeral };
    } catch (error: any) {
      throw new Error(`Falha ao gerar relatório agrupado: ${error.message}`);
    }
  }

  /**
   * Saldo anterior: receitas - despesas de lançamentos COMPLETED com data do
   * regime anterior a startDate, respeitando os demais filtros e excluindo
   * transferências. Com filtro status=PENDING não se aplica (= 0). Compartilhado
   * entre Extrato e Receitas/Despesas (Fluxo de Caixa), que têm o mesmo Resumo.
   */
  private static async computeSaldoAnterior(
    params: ReportParams,
    where: any,
    dateField: 'effective_date' | 'event_date',
    start: Date
  ): Promise<number> {
    if (params.status === 'PENDING') return 0;

    const { [dateField]: _period, status: _status, ...rest } = where;
    const previousWhere: any = {
      ...rest,
      [dateField]: { lt: start },
      status: 'COMPLETED',
    };

    const sumByType = async (type: 'INCOME' | 'EXPENSE'): Promise<number> => {
      const result = await prisma.transaction.aggregate({
        where: { ...previousWhere, category: { ...(previousWhere.category ?? {}), type } },
        _sum: { amount: true },
      });
      return Number(result._sum.amount ?? 0);
    };

    const [previousIncome, previousExpense] = await Promise.all([
      sumByType('INCOME'),
      sumByType('EXPENSE'),
    ]);
    return previousIncome - previousExpense;
  }

  /**
   * GET /financial-reports/extrato
   *
   * Saldo acumulado (balance): escolha de implementação — o running balance
   * parte do saldoAnterior e soma TODAS as linhas exibidas (crédito - débito),
   * independentemente do status de cada linha. Quando o filtro de status é
   * PENDING, saldoAnterior não se aplica (fica 0) e o acumulado parte do zero.
   */
  static async getExtratoReport(params: ReportParams) {
    try {
      const { where, dateField, start } = this.buildBaseWhere(params);

      const transactions = await prisma.transaction.findMany({
        where,
        include: INCLUDE_CONFIG,
        orderBy: [{ [dateField]: 'asc' }, { id: 'asc' }],
      });

      const saldoAnterior = await this.computeSaldoAnterior(params, where, dateField, start);

      let balance = saldoAnterior;
      let totalReceitas = 0;
      let totalDespesas = 0;

      const items = transactions.map((t) => {
        const isIncome = t.category?.type === 'INCOME';
        const amount = Number(t.amount);
        const credit = isIncome ? amount : 0;
        const debit = isIncome ? 0 : amount;
        totalReceitas += credit;
        totalDespesas += debit;
        balance += credit - debit;

        return {
          ...this.mapItem(t),
          credit,
          debit,
          balance,
        };
      });

      const balancoPeriodo = totalReceitas - totalDespesas;

      return {
        items,
        summary: {
          saldoAnterior,
          totalReceitas,
          totalDespesas,
          balancoPeriodo,
          saldoFinal: saldoAnterior + balancoPeriodo,
        },
      };
    } catch (error: any) {
      throw new Error(`Falha ao gerar extrato: ${error.message}`);
    }
  }

  /**
   * GET /financial-reports/income-expense (ignora o filtro de type)
   *
   * Resumo igual ao do Extrato (mesmo Saldo Anterior/Final), conforme pedido no
   * features.md: "Ter o Resumo, como já descrito no Relatório do Extrato".
   */
  static async getIncomeExpenseReport(params: ReportParams) {
    try {
      const effectiveParams = { ...params, type: undefined };
      const { where, dateField, start } = this.buildBaseWhere(effectiveParams);

      const transactions = await prisma.transaction.findMany({
        where,
        include: INCLUDE_CONFIG,
      });

      const receitas = transactions.filter((t) => t.category?.type === 'INCOME');
      const despesas = transactions.filter((t) => t.category?.type === 'EXPENSE');

      const buildSide = (list: any[]) => {
        const groups = this.buildGroups(list, 'category', dateField).map((g) => ({
          categoryId: g.key,
          category: g.label,
          total: g.total,
          count: g.count,
          items: g.items,
        }));
        const total = groups.reduce((sum, g) => sum + g.total, 0);
        return { groups, total };
      };

      const receitasResult = buildSide(receitas);
      const despesasResult = buildSide(despesas);

      const saldoAnterior = await this.computeSaldoAnterior(effectiveParams, where, dateField, start);
      const balancoPeriodo = receitasResult.total - despesasResult.total;

      return {
        receitas: receitasResult,
        despesas: despesasResult,
        summary: {
          saldoAnterior,
          totalReceitas: receitasResult.total,
          totalDespesas: despesasResult.total,
          balancoPeriodo,
          saldoFinal: saldoAnterior + balancoPeriodo,
        },
      };
    } catch (error: any) {
      throw new Error(`Falha ao gerar relatório de receitas e despesas: ${error.message}`);
    }
  }

  /**
   * GET /financial-reports/demonstrativo (DFC)
   *
   * Ignora o filtro de type (precisa das duas pontas). As despesas só entram
   * numa linha do DFC se a categoria tiver `dfc_group` classificado — o total
   * de despesas sem classificação volta em `unclassifiedExpenseTotal` para o
   * front avisar o usuário (evita "sumir" dinheiro do relatório em silêncio).
   */
  static async getDemonstrativoReport(params: ReportParams, groupBy: DfcGroupBy = 'day') {
    try {
      const { where, dateField } = this.buildBaseWhere({ ...params, type: undefined });

      const transactions = await prisma.transaction.findMany({
        where,
        include: { ...INCLUDE_CONFIG, category: { select: { id: true, name: true, type: true, dfc_group: true } } },
      });

      const incomeTxns = transactions.filter((t) => t.category?.type === 'INCOME');
      const expenseTxns = transactions.filter((t) => t.category?.type === 'EXPENSE');
      const byDfcGroup = (group: string) => expenseTxns.filter((t) => t.category?.dfc_group === group);

      const impostosTxns = byDfcGroup('TAXES');
      const variaveisTxns = byDfcGroup('VARIABLE_EXPENSE');
      const fixasTxns = byDfcGroup('FIXED_EXPENSE');
      const pessoalTxns = byDfcGroup('PAYROLL');
      const unclassifiedTxns = expenseTxns.filter((t) => !t.category?.dfc_group);

      const sumOf = (list: any[]) => list.reduce((sum, t) => sum + Number(t.amount), 0);
      const groupsOf = (list: any[]) => this.buildGroups(list, groupBy, dateField);

      const receitaBruta = sumOf(incomeTxns);
      const devolucoes = 0;
      const impostos = sumOf(impostosTxns);
      const resultadoBruto = receitaBruta - devolucoes - impostos;
      const despesasVariaveis = sumOf(variaveisTxns);
      const lucroOperacionalBruto = resultadoBruto - despesasVariaveis;
      const despesasFixas = sumOf(fixasTxns);
      const despesasPessoal = sumOf(pessoalTxns);
      const resultado = lucroOperacionalBruto - despesasFixas - despesasPessoal;

      const lines = [
        { key: 'receita_bruta', label: 'Receita Bruta', kind: 'line' as const, sign: 1 as const, total: receitaBruta, groups: groupsOf(incomeTxns) },
        { key: 'devolucoes', label: 'Devoluções', kind: 'line' as const, sign: -1 as const, total: devolucoes, groups: [] },
        { key: 'impostos', label: 'Impostos', kind: 'line' as const, sign: -1 as const, total: impostos, groups: groupsOf(impostosTxns) },
        { key: 'resultado_bruto', label: 'Resultado Bruto', kind: 'subtotal' as const, sign: resultadoBruto < 0 ? -1 as const : 1 as const, total: resultadoBruto, groups: [] },
        { key: 'despesas_variaveis', label: 'Total de Despesas Variáveis', kind: 'line' as const, sign: -1 as const, total: despesasVariaveis, groups: groupsOf(variaveisTxns) },
        { key: 'lucro_operacional_bruto', label: 'Lucro Operacional Bruto', kind: 'subtotal' as const, sign: lucroOperacionalBruto < 0 ? -1 as const : 1 as const, total: lucroOperacionalBruto, groups: [] },
        { key: 'despesas_fixas', label: 'Total Despesas Fixas', kind: 'line' as const, sign: -1 as const, total: despesasFixas, groups: groupsOf(fixasTxns) },
        { key: 'despesas_pessoal', label: 'Despesas com Pessoal', kind: 'line' as const, sign: -1 as const, total: despesasPessoal, groups: groupsOf(pessoalTxns) },
        { key: 'resultado', label: 'Resultado (Lucro/Prejuízo Líquido)', kind: 'final' as const, sign: resultado < 0 ? -1 as const : 1 as const, total: resultado, groups: [] },
      ];

      return { groupBy, lines, unclassifiedExpenseTotal: sumOf(unclassifiedTxns) };
    } catch (error: any) {
      throw new Error(`Falha ao gerar demonstrativo: ${error.message}`);
    }
  }
}
