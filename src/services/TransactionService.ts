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

  private static safeGetProperty(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
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

  private static filterTransactionsBySearch(transactions: any[], searchTerm: string): any[] {
    if (!searchTerm.trim()) return transactions;
    const normalizedSearchTerm = this.normalizeText(searchTerm);

    return transactions.filter(t => {
      const statusPt = t.status === 'COMPLETED' ? 'concluido' : (t.status === 'PENDING' ? 'pendente' : '');
      const typePt = t.category?.type === 'INCOME' ? 'receita' : (t.category?.type === 'EXPENSE' ? 'despesa' : '');
      
      const formattedAmount = t.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.amount)) : '';
      const formattedEventDate = t.event_date ? new Date(t.event_date).toLocaleDateString('pt-BR') : '';
      const formattedEffectiveDate = t.effective_date ? new Date(t.effective_date).toLocaleDateString('pt-BR') : '';

      // Trazendo as Subcategorias Atreladas daquela categoria específica como texto (Pois você removeu o subcategory_id)
      const subcategoriesString = t.category?.subcategories ? t.category.subcategories.map((s: any) => s.name).join(' ') : '';

      const fieldsToSearch = [
        t.description,
        String(t.amount),
        formattedAmount,
        statusPt,
        typePt,
        t.category?.name,
        subcategoriesString,
        t.financial_institution?.name,
        t.card?.name,
        t.center?.name,
        formattedEventDate,
        formattedEffectiveDate
      ].filter(Boolean).join(' '); 

      return this.normalizeText(fieldsToSearch).includes(normalizedSearchTerm);
    });
  }

  static async getTransactionFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };

      if (filters) {
        const andFilters: any[] = [];
        Object.entries(filters).forEach(([key, value]) => {
           if (!value) return;
           if (key === 'status') andFilters.push({ status: value });
           if (['category_id', 'financial_institution_id', 'card_id', 'center_id'].includes(key)) {
             andFilters.push({ [key]: String(value) });
           }
           // Adaptação: caso tente filtrar por subcategoria, ele busca nas subcategorias filhas da categoria amarrada
           if (key === 'subcategory_id') {
              andFilters.push({ category: { subcategories: { some: { id: String(value) } } } });
           }
           if (key === 'type') {
             andFilters.push({ category: { type: value } });
           }
           if (key === 'description') {
             andFilters.push({ description: { contains: String(value), mode: 'insensitive' } });
           }
           if (key === 'amount') {
             const numericValue = Number(String(value).replace(/[^\d.-]/g, ''));
             if (!isNaN(numericValue)) andFilters.push({ amount: numericValue });
           }
           if (key === 'event_date' || key === 'effective_date') {
             const dateCond = this.buildDateCondition(value);
             if (Object.keys(dateCond).length > 0) andFilters.push({ [key]: dateCond });
           }
        });
        if (andFilters.length) where.AND = andFilters;
      }

      const [
        transactions,
        categories,
        subcategories,
        institutions,
        cards,
        centers,
        dateRange
      ] = await Promise.all([
        prisma.transaction.findMany({
          where,
          select: { description: true, status: true, amount: true },
          distinct: ['description', 'status', 'amount']
        }),
        prisma.category.findMany({ 
          where: { deleted_at: null, transactions: { some: { deleted_at: null } } }, 
          select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } 
        }),
        // Busca subcategorias que os pais (categorias) tem transação
        prisma.subcategory.findMany({ 
          where: { deleted_at: null, category: { transactions: { some: { deleted_at: null } } } }, 
          select: { id: true, name: true, category_id: true }, orderBy: { name: 'asc' } 
        }),
        prisma.financialInstitution.findMany({ 
          where: { deleted_at: null, transactions: { some: { deleted_at: null } } }, 
          select: { id: true, name: true }, orderBy: { name: 'asc' } 
        }),
        prisma.card.findMany({ 
          where: { deleted_at: null, transactions: { some: { deleted_at: null } } }, 
          select: { id: true, name: true }, orderBy: { name: 'asc' } 
        }),
        prisma.center.findMany({ 
          where: { deleted_at: null, transactions: { some: { deleted_at: null } } }, 
          select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } 
        }),
        prisma.transaction.aggregate({
          where,
          _min: { event_date: true, effective_date: true },
          _max: { event_date: true, effective_date: true }
        })
      ]);

      const uniqueDescriptions = Array.from(new Set(transactions.map(t => t.description).filter(Boolean))).sort();
      
      const uniqueAmounts = Array.from(new Set(transactions.map(t => Number(t.amount)).filter(val => !isNaN(val)))).sort((a, b) => a - b);
      const amountOptions = uniqueAmounts.map(amount => ({
        label: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount),
        value: amount
      }));

      const existingStatuses = Array.from(new Set(transactions.map(t => t.status).filter(Boolean)));
      const statusOptions = existingStatuses.map(s => ({
        value: s,
        label: s === 'COMPLETED' ? 'Concluído' : 'Pendente'
      }));

      return {
        filters: [
          { 
            field: 'event_date', 
            type: 'date', 
            label: 'Data do Evento', 
            min: dateRange._min.event_date?.toISOString().split('T')[0], 
            max: dateRange._max.event_date?.toISOString().split('T')[0],
            dateRange: true 
          },
          { 
            field: 'effective_date', 
            type: 'date', 
            label: 'Data de Efetivação', 
            min: dateRange._min.effective_date?.toISOString().split('T')[0], 
            max: dateRange._max.effective_date?.toISOString().split('T')[0],
            dateRange: true 
          },
          { 
            field: 'category_id', 
            type: 'select', 
            label: 'Categoria', 
            values: categories.map(c => ({ value: c.id, label: `${c.name} (${c.type === 'INCOME' ? 'Receita' : 'Despesa'})` })) 
          },
          { 
            field: 'subcategory_id', 
            type: 'select', 
            label: 'Subcategoria (Informativo)', 
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
            values: centers.map(c => ({ value: c.id, label: `${c.name} (${c.type === 'INCOME' ? 'Receita' : 'Despesa'})` })) 
          },
          { 
            field: 'description', 
            type: 'select', 
            label: 'Descrição', 
            values: uniqueDescriptions.map(d => ({ label: d, value: d })),
            searchable: true 
          },
          { 
            field: 'amount', 
            type: 'select', 
            label: 'Valor',
            values: amountOptions,
            searchable: true 
          },
          { 
            field: 'status', 
            type: 'select', 
            label: 'Status', 
            values: statusOptions 
          }
        ],
        operators: {
          string: ['contains', 'equals', 'startsWith', 'endsWith'],
          number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
          date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
          boolean: ['equals'],
          select: ['equals', 'in']
        },
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

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          if (key === 'status') where.status = value;
          if (['category_id', 'financial_institution_id', 'card_id', 'center_id'].includes(key)) {
            where[key] = String(value);
          }
          if (key === 'subcategory_id') {
            where.category = { subcategories: { some: { id: String(value) } } };
          }
          if (key === 'type') {
            where.category = { type: value }; 
          }
          if (key === 'description') {
            where.description = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
          }
          if (key === 'amount') {
            const numericValue = Number(String(value).replace(/[^\d.-]/g, ''));
            if (!isNaN(numericValue)) where.amount = numericValue;
          }
          if (key === 'event_date' || key === 'effective_date') {
            where[key] = this.buildDateCondition(value);
          }
        }
      });

      let transactions: any[] = [];
      let total = 0;

      // Injeta as subcategorias da categoria pai para funcionar a busca
      const includeConfig = { 
        category: { include: { subcategories: { where: { deleted_at: null } } } }, 
        financial_institution: true, 
        card: true, 
        center: true 
      };

      if (search.trim()) {
        const allTransactions = await prisma.transaction.findMany({ 
          where,
          include: includeConfig
        });
        
        let filtered = this.filterTransactionsBySearch(allTransactions, search);
        total = filtered.length;

        const sortEntries = Object.entries(sortOptions) as any;
        if (sortEntries.length > 0) {
          const field = sortEntries[0][0];
          const direction = this.normalizeSortDirection(sortEntries[0][1]);
          
          filtered = filtered.sort((a, b) => {
             const realField = field.endsWith('_id') ? field.replace('_id', '') + '.name' : field;
             
             let valA = this.safeGetProperty(a, realField);
             let valB = this.safeGetProperty(b, realField);

             if (valA === undefined) valA = (a as any)[field];
             if (valB === undefined) valB = (b as any)[field];

             if (typeof valA === 'number' || valA instanceof Date) {
               return direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
             }
             const strA = this.normalizeText(String(valA || ''));
             const strB = this.normalizeText(String(valB || ''));
             return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          });
        } else {
          filtered = filtered.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
        }
        
        transactions = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        
        Object.entries(sortOptions).forEach(([field, direction]) => {
          const dir = this.normalizeSortDirection(direction as string);
          
          if (['event_date', 'effective_date', 'amount', 'status', 'description', 'created_at'].includes(field)) {
            orderBy.push({ [field]: dir });
          } 
          else if (field === 'category_id') {
            orderBy.push({ category: { name: dir } });
          } else if (field === 'subcategory_id') {
            orderBy.push({ category: { name: dir } }); // Orderna pelo pai já que o filho é embutido
          } else if (field === 'financial_institution_id') {
            orderBy.push({ financial_institution: { name: dir } });
          } else if (field === 'card_id') {
            orderBy.push({ card: { name: dir } });
          } else if (field === 'center_id') {
            orderBy.push({ center: { name: dir } });
          }
        });
        
        if (orderBy.length === 0) orderBy.push({ event_date: 'desc' });

        const [data, count] = await Promise.all([
          prisma.transaction.findMany({ 
            where, skip, take, orderBy,
            include: includeConfig
          }),
          prisma.transaction.count({ where })
        ]);

        transactions = data;
        total = count;
      }

      // Converte as subcategorias do formato novo (dentro do objeto category) para a raiz do objeto, 
      // assim o frontend continua a achar "subcategory.name" quando for listar e renderizar!
      const mappedTransactions = transactions.map(t => ({
        ...t,
        subcategory: t.category?.subcategories && t.category.subcategories.length > 0 
          ? { name: t.category.subcategories.map((s: any) => s.name).join(', ') }
          : { name: 'Nenhuma' }
      }));

      const aggregations = await prisma.transaction.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true }
      });

      return {
        data: mappedTransactions,
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
        include: { category: { include: { subcategories: { where: { deleted_at: null } } } }, financial_institution: true, card: true, center: true }
      });
      if (!transaction) throw new Error('Transaction not found');
      return transaction;
    } catch (error: any) { throw error; }
  }

  static async createTransaction(data: any) {
    try {
      const parseFK = (val: any) => (val === '' || val === 'null' || !val) ? null : val;

      return await prisma.transaction.create({
        data: {
          event_date: new Date(data.event_date),
          effective_date: new Date(data.effective_date),
          description: data.description,
          amount: Number(data.amount),
          status: data.status || 'PENDING',
          category_id: data.category_id,
          subcategory_id: null, // Campo obsoleto no banco, não passamos.
          financial_institution_id: data.financial_institution_id,
          card_id: parseFK(data.card_id),
          center_id: parseFK(data.center_id)
        },
        include: { category: true, financial_institution: true }
      });
    } catch (error: any) { throw error; }
  }

  static async updateTransaction(id: string, data: any) {
    try {
      const existing = await prisma.transaction.findUnique({ where: { id, deleted_at: null } });
      if (!existing) throw new Error('Transaction not found');

      const parseFKUpdate = (val: any) => {
        if (val === '' || val === 'null' || val === null) return null;
        return val !== undefined ? val : undefined;
      };

      return await prisma.transaction.update({
        where: { id },
        data: {
          event_date: data.event_date ? new Date(data.event_date) : undefined,
          effective_date: data.effective_date ? new Date(data.effective_date) : undefined,
          description: data.description,
          amount: data.amount !== undefined ? Number(data.amount) : undefined,
          status: data.status,
          category_id: data.category_id,
          subcategory_id: null,
          financial_institution_id: data.financial_institution_id,
          card_id: parseFKUpdate(data.card_id),
          center_id: parseFKUpdate(data.center_id)
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