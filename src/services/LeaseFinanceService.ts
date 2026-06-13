import prisma from '../lib/prisma';
import { CategoryService } from './CategoryService';
import { createDateLocal, parseLocalDate } from '../utils/date-utils';

/**
 * Geração automática dos lançamentos financeiros de uma locação.
 *
 * Regras (definidas com o cliente):
 *  - Aluguel: 1 lançamento de RECEITA (INCOME) por mês do período (start..end), no rent_due_day.
 *  - Comissão: 1 lançamento de DESPESA (EXPENSE) por mês (se commission_amount > 0).
 *  - IPTU: 1 lançamento de RECEITA (INCOME) por parcela, conforme payment_condition.
 *  - Contato (supplier_id) = fornecedor-espelho da imobiliária vinculada.
 *  - Centro de custo (center_id) = centro do imóvel, quando houver.
 *
 * Idempotência: cada transação gerada carrega lease_id + (category_id, installment_number).
 * Ao re-sincronizar, as PENDING geradas são removidas e recriadas; as COMPLETED são
 * preservadas e seus períodos não são duplicados.
 */

const LEASE_CATEGORIES = {
  RENT: { name: 'Receita de Locação', type: 'INCOME' as const },
  COMMISSION: { name: 'Comissão Imobiliária', type: 'EXPENSE' as const },
  IPTU: { name: 'IPTU', type: 'INCOME' as const },
};

interface ScheduleItem {
  category_id: string;
  amount: number;
  date: Date;
  installment_number: number;
  total: number;
  description: string;
}

export class LeaseFinanceService {
  /** Lista de {year, month(1-12)} de start a end, inclusive, mês a mês. */
  private static monthsBetween(start: Date, end: Date): { year: number; month: number }[] {
    const s = parseLocalDate(start);
    const e = parseLocalDate(end);
    const out: { year: number; month: number }[] = [];
    let y = s.getUTCFullYear();
    let m = s.getUTCMonth() + 1; // 1-12
    const endY = e.getUTCFullYear();
    const endM = e.getUTCMonth() + 1;
    // Guarda contra ranges inválidos/imensos
    let guard = 0;
    while ((y < endY || (y === endY && m <= endM)) && guard < 600) {
      out.push({ year: y, month: m });
      m++;
      if (m > 12) { m = 1; y++; }
      guard++;
    }
    return out;
  }

  /** Cria data no dia desejado, ajustando para o último dia do mês quando necessário. */
  private static dueDate(year: number, month: number, day: number): Date {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // último dia do mês
    const safeDay = Math.min(Math.max(day || 1, 1), lastDay);
    return createDateLocal(year, month, safeDay);
  }

  /** Resolve (find-or-create) o fornecedor-espelho da imobiliária. */
  private static async resolveAgencySupplier(agencyId: string, company_id: string): Promise<string | null> {
    const existing = await prisma.supplier.findFirst({
      where: { agency_id: agencyId, company_id, deleted_at: null },
    });
    if (existing) return existing.id;

    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) return null;

    // internal_code determinístico e único por imobiliária (a constraint
    // @@unique([company_id, internal_code]) nesta base trata NULLs como iguais,
    // então não dá para usar NULL). Identificação real do mirror é por agency_id.
    const supplier = await prisma.supplier.create({
      data: {
        legal_name: agency.legal_name,
        trade_name: agency.trade_name,
        cnpj: agency.cnpj,
        internal_code: `AG-${agencyId.slice(0, 8)}`,
        created_via: 'agency_mirror',
        is_active: true,
        agency: { connect: { id: agencyId } },
        company: { connect: { id: company_id } },
      },
    });
    return supplier.id;
  }

  /** Monta as parcelas de IPTU conforme a condição de pagamento da locação. */
  private static buildIptuItems(lease: any, iptuCategoryId: string): ScheduleItem[] {
    const year = lease.iptu_year || new Date().getUTCFullYear();
    const taxDay = lease.tax_due_day || 10;
    const items: { amount: number; date: Date }[] = [];

    const num = (v: any) => (v != null ? Number(v) : 0);
    const round2 = (v: number) => Math.round(v * 100) / 100;
    const base = num(lease.property_tax);

    switch (lease.payment_condition) {
      case 'IN_FULL_15_DISCOUNT': {
        // À vista com 15% de desconto → 1 único lançamento já descontado.
        // Usa o valor informado (Valor de Cobrança À vista); se ausente,
        // calcula a partir da base do IPTU (base × 0,85).
        // Data: usa property_tax_cash_due_date se informada; senão fallback dia do vencimento.
        const informed = num(lease.property_tax_cash);
        const amount = informed > 0 ? round2(informed) : round2(base * 0.85);
        if (amount > 0) {
          const date = lease.property_tax_cash_due_date
            ? parseLocalDate(lease.property_tax_cash_due_date)
            : this.dueDate(year, 1, taxDay);
          items.push({ amount, date });
        }
        break;
      }
      case 'SECOND_INSTALLMENT_10_DISCOUNT': {
        // 2 parcelas com 10% de desconto → 2 lançamentos com datas individuais.
        // Usa os valores informados (1ª+2ª parcela); se ausentes,
        // calcula base × 0,90 dividido em 2 parcelas iguais.
        const amt1 = num(lease.property_tax_first_installment);
        const amt2 = num(lease.property_tax_second_installment);
        const half = round2(base * 0.45); // fallback: 90% / 2
        const a1 = amt1 > 0 ? round2(amt1) : half;
        const a2 = amt2 > 0 ? round2(amt2) : half;
        const d1 = lease.property_tax_first_installment_due_date
          ? parseLocalDate(lease.property_tax_first_installment_due_date)
          : this.dueDate(year, 1, taxDay);
        const d2 = lease.property_tax_second_installment_due_date
          ? parseLocalDate(lease.property_tax_second_installment_due_date)
          : this.dueDate(year, 2, taxDay);
        if (a1 > 0) items.push({ amount: a1, date: d1 });
        if (a2 > 0) items.push({ amount: a2, date: d2 });
        break;
      }
      case 'INSTALLMENTS': {
        const amounts: any[] = Array.isArray(lease.iptu_installments) ? lease.iptu_installments : [];
        const dueDates: any[] = Array.isArray(lease.iptu_installments_due_dates) ? lease.iptu_installments_due_dates : [];
        amounts.forEach((a, idx) => {
          const amount = num(a);
          if (amount <= 0) return;
          const rawDate = dueDates[idx];
          const date = rawDate ? parseLocalDate(rawDate) : this.dueDate(year, ((idx % 12) + 1), taxDay);
          items.push({ amount, date });
        });
        break;
      }
      default:
        break;
    }

    return items.map((it, idx) => ({
      category_id: iptuCategoryId,
      amount: it.amount,
      date: it.date,
      installment_number: idx + 1,
      total: items.length,
      description: `IPTU ${idx + 1}/${items.length} - Contrato ${lease.contract_number}`,
    }));
  }

  /**
   * Sincroniza os lançamentos financeiros da locação.
   * Retorna a quantidade gerada e, se aplicável, um aviso (warning).
   */
  static async syncLeaseTransactions(
    leaseId: string,
    company_id: string,
  ): Promise<{ generated: number; warning?: string }> {
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: { property: { select: { center_id: true } } },
    });
    if (!lease || lease.deleted_at) return { generated: 0 };

    if (!lease.financial_institution_id) {
      return {
        generated: 0,
        warning: 'Lançamentos financeiros não gerados: selecione uma instituição financeira na locação.',
      };
    }

    // 1. Categorias (find-or-create)
    const [rentCat, commissionCat, iptuCat] = await Promise.all([
      CategoryService.quickCreate(LEASE_CATEGORIES.RENT, company_id),
      CategoryService.quickCreate(LEASE_CATEGORIES.COMMISSION, company_id),
      CategoryService.quickCreate(LEASE_CATEGORIES.IPTU, company_id),
    ]);

    // 2. Fornecedor-espelho da imobiliária + centro do imóvel
    const supplierId = lease.agency_id
      ? await this.resolveAgencySupplier(lease.agency_id, company_id)
      : null;
    const centerId = lease.property?.center_id ?? null;

    // 3. Schedule desejado
    const items: ScheduleItem[] = [];
    const months = this.monthsBetween(lease.start_date, lease.end_date);
    const rentAmount = Number(lease.rent_amount);
    const commissionAmount = lease.commission_amount ? Number(lease.commission_amount) : 0;

    months.forEach((m, idx) => {
      const date = this.dueDate(m.year, m.month, lease.rent_due_day);
      items.push({
        category_id: rentCat.id,
        amount: rentAmount,
        date,
        installment_number: idx + 1,
        total: months.length,
        description: `Aluguel ${idx + 1}/${months.length} - Contrato ${lease.contract_number}`,
      });
      if (commissionAmount > 0) {
        items.push({
          category_id: commissionCat.id,
          amount: commissionAmount,
          date,
          installment_number: idx + 1,
          total: months.length,
          description: `Comissão ${idx + 1}/${months.length} - Contrato ${lease.contract_number}`,
        });
      }
    });

    items.push(...this.buildIptuItems(lease, iptuCat.id));

    // 4. Idempotência: separa existentes PENDING (regerar) de COMPLETED (preservar)
    const existing = await prisma.transaction.findMany({
      where: { lease_id: leaseId, deleted_at: null },
      select: { id: true, status: true, category_id: true, installment_number: true },
    });
    const completedKeys = new Set(
      existing
        .filter((t) => t.status === 'COMPLETED')
        .map((t) => `${t.category_id}::${t.installment_number}`),
    );
    const pendingIds = existing.filter((t) => t.status !== 'COMPLETED').map((t) => t.id);

    if (pendingIds.length > 0) {
      await prisma.transaction.updateMany({
        where: { id: { in: pendingIds } },
        data: { deleted_at: new Date() },
      });
    }

    // 5. Cria apenas o que não está coberto por uma transação COMPLETED
    const toCreate = items.filter(
      (it) => !completedKeys.has(`${it.category_id}::${it.installment_number}`),
    );

    for (const it of toCreate) {
      await prisma.transaction.create({
        data: {
          event_date: it.date,
          effective_date: it.date,
          description: it.description,
          amount: it.amount,
          status: 'PENDING',
          category_id: it.category_id,
          financial_institution_id: lease.financial_institution_id,
          supplier_id: supplierId,
          center_id: centerId,
          lease_id: leaseId,
          installment_number: it.installment_number,
          total_installments: it.total,
          company_id,
        },
      });
    }

    return { generated: toCreate.length };
  }
}
