import prisma from '@/lib/prisma';
import { parseLocalDate } from '../utils/date-utils';

/**
 * RecurringService — modelo ÚNICO de recorrência infinita (config-based).
 *
 * Substitui a antiga "Recorrente finita" da UI e consolida o item AtmosERP.
 * Uma recorrência é uma `RecurringConfig` (pai) que gera `Transaction`s filhas
 * vinculadas por `recurring_group_id` (= config.id) + `occurrence_number`.
 *
 * Janela alvo: sempre ~5 anos à frente. A criação gera até `hoje + 5 anos`;
 * o serviço de manutenção (`extendActiveRecurrences`) estende a janela.
 *
 * Idempotência: `createMany({ skipDuplicates: true })` sobre o unique
 * `(recurring_group_id, occurrence_number)` garante que reexecuções não
 * dupliquem lançamentos.
 */

export type RecurringFrequency =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'YEARLY';

const YEARS_AHEAD = 5;

/**
 * Calcula a data da ocorrência `index` (0-based) a partir da data-base,
 * conforme a periodicidade. Base = 1º pagamento.
 *
 * Semanal=+7d; Quinzenal=+14d; Mensal=+1m; Bimestral=+2m; Trimestral=+3m;
 * Semestral=+6m; Anual=+1a. Para os baseados em mês, se o dia estourar o fim
 * do mês (ex.: 31 → fev), ajusta para o último dia do mês.
 */
export function computeOccurrenceDate(
  baseDate: Date,
  index: number,
  frequency: RecurringFrequency,
): Date {
  const y = baseDate.getUTCFullYear();
  const m = baseDate.getUTCMonth();
  const d = baseDate.getUTCDate();

  const addDays = (days: number) =>
    new Date(Date.UTC(y, m, d + days));

  const addMonths = (months: number) => {
    const targetMonthFirst = new Date(Date.UTC(y, m + months, 1));
    const ty = targetMonthFirst.getUTCFullYear();
    const tm = targetMonthFirst.getUTCMonth();
    // Último dia do mês alvo, para ajustar quando o dia-base não existe (ex.: 31)
    const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ty, tm, Math.min(d, lastDay)));
  };

  switch (frequency) {
    case 'WEEKLY':
      return addDays(7 * index);
    case 'BIWEEKLY':
      return addDays(14 * index);
    case 'MONTHLY':
      return addMonths(index);
    case 'BIMONTHLY':
      return addMonths(2 * index);
    case 'QUARTERLY':
      return addMonths(3 * index);
    case 'SEMIANNUAL':
      return addMonths(6 * index);
    case 'YEARLY':
      return addMonths(12 * index);
    default:
      return addMonths(index);
  }
}

function cutoffDate(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear() + YEARS_AHEAD, from.getUTCMonth(), from.getUTCDate()));
}

export class RecurringService {
  /**
   * Cria uma recorrência: persiste a `RecurringConfig` e gera todas as
   * ocorrências até `hoje + 5 anos`. Vale para DESPESA e RECEITA.
   *
   * Espera em `data`:
   *  - transaction_type: 'EXPENSE' | 'INCOME'
   *  - frequency: RecurringFrequency
   *  - amount, category_id, institution_id, start_date, first_payment_date
   *  - opcionais: subcategory_id, card_id, center_id, supplier_id, description
   */
  static async createRecurring(data: any, company_id: string) {
    const parseFK = (val: any) => (val === '' || val === 'null' || !val) ? null : val;
    const parseAmount = (val: any): number => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const clean = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    const frequency = String(data.frequency || 'MONTHLY') as RecurringFrequency;
    const amount = parseAmount(data.amount);
    const startDate = parseLocalDate(data.start_date);
    const firstPaymentDate = parseLocalDate(data.first_payment_date);
    const transactionType = data.transaction_type === 'INCOME' ? 'INCOME' : 'EXPENSE';

    if (amount <= 0) throw new Error('Valor deve ser maior que zero');
    if (!data.category_id) throw new Error('Categoria é obrigatória');
    if (!data.institution_id) throw new Error('Instituição financeira é obrigatória');
    if (firstPaymentDate < startDate) {
      throw new Error('Data de primeiro pagamento deve ser igual ou posterior à data inicial');
    }

    const config = await prisma.recurringConfig.create({
      data: {
        description: data.description || (transactionType === 'INCOME' ? 'Receita Recorrente' : 'Despesa Recorrente'),
        amount,
        frequency: frequency as any,
        category_id: data.category_id,
        subcategory_id: parseFK(data.subcategory_id),
        financial_institution_id: data.institution_id,
        card_id: parseFK(data.card_id),
        center_id: parseFK(data.center_id),
        supplier_id: transactionType === 'EXPENSE' ? parseFK(data.supplier_id) : null,
        start_date: startDate,
        end_date: null,
        is_active: true,
        company_id,
      },
    });

    const generated = await this.generateForConfig(config, firstPaymentDate);

    return {
      success: true,
      message: `${generated} lançamentos recorrentes criados (janela de ${YEARS_AHEAD} anos)`,
      data: {
        recurring_group_id: config.id,
        frequency,
        generated,
      },
    };
  }

  /**
   * Gera ocorrências para uma config até `hoje + 5 anos`, a partir da próxima
   * `occurrence_number` ainda inexistente. Idempotente (skipDuplicates).
   *
   * @param firstPaymentDate data-base da 1ª ocorrência (só usada na criação
   *        inicial; nas extensões é derivada da config.start_date + índice).
   */
  private static async generateForConfig(config: any, firstPaymentDate?: Date): Promise<number> {
    const today = parseLocalDate(new Date());
    const limit = cutoffDate(today);

    // Data-base: na criação inicial vem o firstPaymentDate; nas extensões
    // reconstruímos a partir da 1ª ocorrência já existente (occurrence_number=1).
    let baseDate = firstPaymentDate;
    if (!baseDate) {
      const first = await prisma.transaction.findFirst({
        where: { recurring_group_id: config.id, occurrence_number: 1 },
        select: { effective_date: true },
      });
      baseDate = first ? parseLocalDate(first.effective_date) : parseLocalDate(config.start_date);
    }

    // Última ocorrência já gerada → próximo número.
    const last = await prisma.transaction.findFirst({
      where: { recurring_group_id: config.id },
      orderBy: { occurrence_number: 'desc' },
      select: { occurrence_number: true },
    });
    const startIndex = last?.occurrence_number ?? 0; // 0-based index da PRÓXIMA (occurrence_number = index+1)

    const frequency = config.frequency as RecurringFrequency;
    const rows: any[] = [];
    const startDateForEvent = parseLocalDate(config.start_date);

    for (let index = startIndex; ; index++) {
      const effectiveDate = computeOccurrenceDate(baseDate, index, frequency);
      if (effectiveDate > limit) break;
      const occurrenceNumber = index + 1;

      rows.push({
        event_date: startDateForEvent,
        effective_date: effectiveDate,
        description: config.description,
        amount: config.amount,
        status: 'PENDING',
        category_id: config.category_id,
        subcategory_id: config.subcategory_id,
        financial_institution_id: config.financial_institution_id,
        card_id: config.card_id,
        center_id: config.center_id,
        supplier_id: config.supplier_id,
        is_recurring: true,
        recurring_group_id: config.id,
        recurring_frequency: frequency,
        occurrence_number: occurrenceNumber,
        payment_mode: 'RECORRENTE',
        company_id: config.company_id,
      });

      // Guarda de segurança contra laços muito longos (5 anos semanais ≈ 260).
      if (rows.length > 2000) break;
    }

    if (rows.length === 0) return 0;

    const result = await prisma.transaction.createMany({
      data: rows,
      skipDuplicates: true,
    });

    await prisma.recurringConfig.update({
      where: { id: config.id },
      data: {
        generated_occurrences: { increment: result.count },
        next_generation_date: limit,
      },
    });

    return result.count;
  }

  /**
   * Serviço de manutenção (Fase 3): estende TODAS as recorrências ativas para
   * manter sempre ~5 anos à frente. Idempotente — só cria o que falta.
   */
  static async extendActiveRecurrences() {
    const today = parseLocalDate(new Date());

    const activeConfigs = await prisma.recurringConfig.findMany({
      where: {
        is_active: true,
        deleted_at: null,
        OR: [{ end_date: null }, { end_date: { gte: today } }],
      },
    });

    let totalGenerated = 0;
    const details: { recurring_group_id: string; generated: number }[] = [];

    for (const config of activeConfigs) {
      const generated = await this.generateForConfig(config);
      if (generated > 0) details.push({ recurring_group_id: config.id, generated });
      totalGenerated += generated;
    }

    return { configs: activeConfigs.length, totalGenerated, details };
  }
}
