import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class TransactionService {
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  private static buildDateCondition(value: any): any {
    if (typeof value === 'object' && value && 'from' in value && 'to' in value) {
      const fromDate = new Date(value.from);
      const toDate = new Date(value.to);
      toDate.setHours(23, 59, 59, 999);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) return { gte: fromDate, lte: toDate };
    } else if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
        return { gte: startOfDay, lte: endOfDay };
      }
    }
    return {};
  }

  static async getTransactionFilters(filters?: Record<string, any>) {
    try {
      const [categories, subcategories, institutions, cards, centers] = await Promise.all([
        prisma.category.findMany({ where: { deleted_at: null }, select: { id: true, name: true, type: true } }),
        prisma.subcategory.findMany({ where: { deleted_at: null }, select: { id: true, name: true, category_id: true } }),
        prisma.financialInstitution.findMany({ where: { deleted_at: null }, select: { id: true, name: true } }),
        prisma.card.findMany({ where: { deleted_at: null }, select: { id: true, name: true } }),
        prisma.center.findMany({ where: { deleted_at: null }, select: { id: true, name: true, type: true } })
      ]);

      return {
        filters: [
          { field: 'status', type: 'select', label: 'Status', values: ['PENDING', 'COMPLETED'] },
          { field: 'type', type: 'select', label: 'Tipo', values: ['INCOME', 'EXPENSE'] },
          { 
            field: 'category_id', 
            type: 'select', 
            label: 'Categoria', 
            values: categories.map(c => ({ value: c.id, label: `${c.name} (${c.type})` })) 
          },
          { 
            field: 'subcategory_id', 
            type: 'select', 
            label: 'Subcategoria', 
            values: subcategories.map(s => ({ value: s.id, label: s.name, category_id: s.category_id })) 
          },
          { 
            field: 'financial_institution_id', 
            type: 'select', 
            label: 'Instituição Financeira', 
            values: institutions.map(i => ({ value: i.id, label: i.name })) 
          },
          { 
            field: 'card_id', 
            type: 'select', 
            label: 'Cartão', 
            values: cards.map(c => ({ value: c.id, label: c.name })) 
          },
          { 
            field: 'center_id', 
            type: 'select', 
            label: 'Centro', 
            values: centers.map(c => ({ value: c.id, label: `${c.name} (${c.type})` })) 
          },
          { field: 'event_date', type: 'date', label: 'Data do Evento', dateRange: true },
          { field: 'effective_date', type: 'date', label: 'Data de Efetivação', dateRange: true }
        ],
        defaultSort: 'event_date:desc',
        searchFields: ['description']
      };
    } catch (error) {
      throw error;
    }
  }

  static async getTransactions(params: any = {}) {
    try {
      const { limit = 30, page = 1, search = '', filters = {}, sortOptions = {}, includeInactive = false } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where: any = {};
      if (!includeInactive) where.deleted_at = null;

      // Filtros Dinâmicos
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          if (key === 'status') where.status = value;
          if (['category_id', 'subcategory_id', 'financial_institution_id', 'card_id', 'center_id'].includes(key)) {
            where[key] = String(value);
          }
          if (key === 'type') {
            where.category = { type: value }; // Filtra despesa/receita com base na categoria
          }
          if (key === 'event_date' || key === 'effective_date') {
            where[key] = this.buildDateCondition(value);
          }
        }
      });

      let transactions: any[] = [];
      let total = 0;

      if (search.trim()) {
        const allTransactions = await prisma.transaction.findMany({ 
          where,
          include: { category: true, subcategory: true, financial_institution: true, card: true, center: true }
        });
        const normalizedSearch = this.normalizeText(search);
        
        let filtered = allTransactions.filter(t => {
          const desc = this.normalizeText(t.description);
          return desc.includes(normalizedSearch);
        });

        total = filtered.length;

        const sortEntries = Object.entries(sortOptions) as any;
        if (sortEntries.length > 0) {
          const field = sortEntries[0][0];
          const direction = this.normalizeSortDirection(sortEntries[0][1]);
          filtered = filtered.sort((a, b) => {
             const valA = (a as any)[field];
             const valB = (b as any)[field];
             // Ordenação para números ou datas
             if (typeof valA === 'number' || valA instanceof Date) {
               return direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
             }
             const strA = String(valA || '');
             const strB = String(valB || '');
             return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          });
        } else {
          filtered = filtered.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
        }
        
        transactions = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        Object.entries(sortOptions).forEach(([field, direction]) => {
          if (['event_date', 'effective_date', 'amount', 'status', 'created_at'].includes(field)) {
            orderBy.push({ [field]: this.normalizeSortDirection(direction as string) });
          }
        });
        if (orderBy.length === 0) orderBy.push({ event_date: 'desc' });

        const [data, count] = await Promise.all([
          prisma.transaction.findMany({ 
            where, skip, take, orderBy,
            include: { category: true, subcategory: true, financial_institution: true, card: true, center: true }
          }),
          prisma.transaction.count({ where })
        ]);

        transactions = data;
        total = count;
      }

      // Resumo de valores (Dashboard auxiliar)
      const aggregations = await prisma.transaction.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true }
      });

      return {
        data: transactions,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
        summary: aggregations
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar lançamentos: ${error.message}`);
    }
  }

  static async getTransactionById(id: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id, deleted_at: null },
        include: { category: true, subcategory: true, financial_institution: true, card: true, center: true }
      });
      if (!transaction) throw new Error('Transaction not found');
      return transaction;
    } catch (error: any) { throw error; }
  }

  static async createTransaction(data: any) {
    try {
      return await prisma.transaction.create({
        data: {
          event_date: new Date(data.event_date),
          effective_date: new Date(data.effective_date),
          description: data.description,
          amount: Number(data.amount),
          status: data.status || 'PENDING',
          category_id: data.category_id,
          subcategory_id: data.subcategory_id || null,
          financial_institution_id: data.financial_institution_id,
          card_id: data.card_id || null,
          center_id: data.center_id || null
        },
        include: { category: true, financial_institution: true }
      });
    } catch (error: any) { throw error; }
  }

  static async updateTransaction(id: string, data: any) {
    try {
      const existing = await prisma.transaction.findUnique({ where: { id, deleted_at: null } });
      if (!existing) throw new Error('Transaction not found');

      return await prisma.transaction.update({
        where: { id },
        data: {
          event_date: data.event_date ? new Date(data.event_date) : undefined,
          effective_date: data.effective_date ? new Date(data.effective_date) : undefined,
          description: data.description,
          amount: data.amount !== undefined ? Number(data.amount) : undefined,
          status: data.status,
          category_id: data.category_id,
          subcategory_id: data.subcategory_id !== undefined ? data.subcategory_id : undefined,
          financial_institution_id: data.financial_institution_id,
          card_id: data.card_id !== undefined ? data.card_id : undefined,
          center_id: data.center_id !== undefined ? data.center_id : undefined
        },
        include: { category: true, financial_institution: true }
      });
    } catch (error: any) { throw error; }
  }

  static async deleteTransaction(id: string) {
    try {
      const transaction = await prisma.transaction.findUnique({ where: { id, deleted_at: null } });
      if (!transaction) throw new Error('Transaction not found or already deleted');

      await prisma.transaction.update({
        where: { id },
        data: { deleted_at: new Date() }
      });

      return transaction;
    } catch (error: any) { throw error; }
  }

  static async restoreTransaction(id: string) {
    try {
      const transaction = await prisma.transaction.findUnique({ where: { id } });
      if (!transaction) throw new Error('Transaction not found');
      if (!transaction.deleted_at) throw new Error('Transaction is not deleted');

      return await prisma.transaction.update({
        where: { id },
        data: { deleted_at: null }
      });
    } catch (error: any) { throw error; }
  }
}