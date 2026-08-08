import prisma from '../lib/prisma';
import { parseLocalDate } from '../utils/date-utils';

export interface IptuAuditSettingsInput {
  income_category_id?: string | null;
  income_subcategory_id?: string | null;
  expense_category_id?: string | null;
  expense_subcategory_id?: string | null;
}

export interface IptuAuditParams {
  startDate: string;
  endDate: string;
}

interface IptuAuditTransactionDetail {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface IptuAuditRow {
  propertyId: string;
  propertyTitle: string;
  address: string | null;
  income: number;
  expense: number;
  balance: number;
  transactions: IptuAuditTransactionDetail[];
}

/**
 * Auditoria de IPTU (Tarefa 3.1 do guia de correções): compara, por imóvel, a
 * restituição de IPTU recebida do inquilino (receita) contra o IPTU pago pela
 * empresa (despesa) — usando as categorias/subcategorias configuradas em
 * IptuAuditSettings, sem duplicar dado: agrega os lançamentos (Transaction) já
 * existentes.
 *
 * O vínculo lançamento → imóvel é sempre via `lease_id` (Transaction não tem
 * property_id próprio) — tanto a restituição gerada automaticamente
 * (LeaseFinanceService) quanto o IPTU pago manualmente devem estar associados a
 * uma locação para entrar na auditoria.
 */
export class AuditService {
  static async getIptuAuditSettings(company_id: string) {
    const settings = await prisma.iptuAuditSettings.findUnique({
      where: { company_id },
      include: {
        income_category: { select: { id: true, name: true } },
        income_subcategory: { select: { id: true, name: true } },
        expense_category: { select: { id: true, name: true } },
        expense_subcategory: { select: { id: true, name: true } },
      },
    });
    return settings;
  }

  static async saveIptuAuditSettings(company_id: string, input: IptuAuditSettingsInput) {
    const data = {
      income_category_id: input.income_category_id || null,
      income_subcategory_id: input.income_subcategory_id || null,
      expense_category_id: input.expense_category_id || null,
      expense_subcategory_id: input.expense_subcategory_id || null,
    };

    return prisma.iptuAuditSettings.upsert({
      where: { company_id },
      update: data,
      create: { company_id, ...data },
    });
  }

  static async getIptuAudit(params: IptuAuditParams, company_id: string): Promise<{ rows: IptuAuditRow[]; totals: { income: number; expense: number; balance: number } }> {
    const settings = await prisma.iptuAuditSettings.findUnique({ where: { company_id } });
    if (!settings || (!settings.income_category_id && !settings.expense_category_id)) {
      throw new Error('Configure as categorias de Receita e Despesa da Auditoria de IPTU antes de gerar o relatório.');
    }

    const start = parseLocalDate(params.startDate);
    const end = parseLocalDate(params.endDate);
    end.setHours(23, 59, 59, 999);

    const buildSideWhere = (categoryId: string | null, subcategoryId: string | null) => {
      if (!categoryId) return null;
      const where: any = {
        deleted_at: null,
        NOT: { is_transfer: true },
        event_date: { gte: start, lte: end },
        category_id: categoryId,
        lease_id: { not: null },
      };
      if (subcategoryId) where.subcategory_id = subcategoryId;
      return where;
    };

    const incomeWhere = buildSideWhere(settings.income_category_id, settings.income_subcategory_id);
    const expenseWhere = buildSideWhere(settings.expense_category_id, settings.expense_subcategory_id);

    const [incomeTxns, expenseTxns] = await Promise.all([
      incomeWhere
        ? prisma.transaction.findMany({
            where: incomeWhere,
            select: {
              id: true, description: true, amount: true, event_date: true,
              lease: { select: { property: { select: { id: true, title: true } } } },
            },
          })
        : Promise.resolve([]),
      expenseWhere
        ? prisma.transaction.findMany({
            where: expenseWhere,
            select: {
              id: true, description: true, amount: true, event_date: true,
              lease: { select: { property: { select: { id: true, title: true } } } },
            },
          })
        : Promise.resolve([]),
    ]);

    const rowsByProperty = new Map<string, IptuAuditRow>();

    const ensureRow = (propertyId: string, propertyTitle: string): IptuAuditRow => {
      let row = rowsByProperty.get(propertyId);
      if (!row) {
        row = { propertyId, propertyTitle, address: null, income: 0, expense: 0, balance: 0, transactions: [] };
        rowsByProperty.set(propertyId, row);
      }
      return row;
    };

    for (const t of incomeTxns) {
      const property = t.lease?.property;
      if (!property) continue;
      const row = ensureRow(property.id, property.title);
      const amount = Number(t.amount);
      row.income += amount;
      row.transactions.push({ id: t.id, description: t.description, amount, date: t.event_date.toISOString().slice(0, 10), type: 'INCOME' });
    }

    for (const t of expenseTxns) {
      const property = t.lease?.property;
      if (!property) continue;
      const row = ensureRow(property.id, property.title);
      const amount = Number(t.amount);
      row.expense += amount;
      row.transactions.push({ id: t.id, description: t.description, amount, date: t.event_date.toISOString().slice(0, 10), type: 'EXPENSE' });
    }

    const propertyIds = Array.from(rowsByProperty.keys());
    if (propertyIds.length > 0) {
      const addresses = await prisma.propertyAddress.findMany({
        where: { property_id: { in: propertyIds }, deleted_at: null },
        select: { property_id: true, address: { select: { street: true, number: true, city: true, state: true } } },
      });
      const addressByProperty = new Map(
        addresses.map((a) => [a.property_id, `${a.address.street}, ${a.address.number} - ${a.address.city}/${a.address.state}`])
      );
      for (const row of rowsByProperty.values()) {
        row.address = addressByProperty.get(row.propertyId) ?? null;
      }
    }

    const rows = Array.from(rowsByProperty.values())
      .map((row) => {
        row.balance = row.income - row.expense;
        row.transactions.sort((a, b) => a.date.localeCompare(b.date));
        return row;
      })
      .sort((a, b) => a.propertyTitle.localeCompare(b.propertyTitle));

    const totals = rows.reduce(
      (acc, row) => ({ income: acc.income + row.income, expense: acc.expense + row.expense, balance: acc.balance + row.balance }),
      { income: 0, expense: 0, balance: 0 }
    );

    return { rows, totals };
  }
}
