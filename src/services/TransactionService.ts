import { ApiResponse } from '../utils/api-response';
import prisma from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { parseLocalDate, displayDate } from '../utils/date-utils';
import { randomUUID } from 'node:crypto';

export class TransactionService {
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  // supplier usa legal_name, não name como as demais relações
  private static readonly RELATION_SORT_FIELDS: Record<string, string> = {
    category_id: 'category.name',
    subcategory_id: 'subcategory.name',
    financial_institution_id: 'financial_institution.name',
    card_id: 'card.name',
    center_id: 'center.name',
    supplier_id: 'supplier.legal_name',
  };

  private static safeGetProperty(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
  }

  private static buildDateCondition(value: any): any {
    if (typeof value === 'object' && value && 'from' in value && 'to' in value) {
      const fromDate = parseLocalDate(value.from);
      const toDate = parseLocalDate(value.to);
      toDate.setHours(23, 59, 59, 999);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) return { gte: fromDate, lte: toDate };
    } else if (typeof value === 'string') {
      const date = parseLocalDate(value);
      if (!isNaN(date.getTime())) {
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
        return { gte: startOfDay, lte: endOfDay };
      }
    }
    return {};
  }

  private static buildAmountRangeCondition(value: any): any {
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && ('min' in value || 'max' in value)) {
      const cond: any = {};
      const min = Number(String(value.min).replace(/[^\d.-]/g, ''));
      const max = Number(String(value.max).replace(/[^\d.-]/g, ''));
      if (value.min !== undefined && value.min !== null && value.min !== '' && !isNaN(min)) cond.gte = min;
      if (value.max !== undefined && value.max !== null && value.max !== '' && !isNaN(max)) cond.lte = max;
      return cond;
    }
    const numericValue = Number(String(value).replace(/[^\d.-]/g, ''));
    return isNaN(numericValue) ? {} : { equals: numericValue };
  }

  private static filterTransactionsBySearch(transactions: any[], searchTerm: string): any[] {
    if (!searchTerm.trim()) return transactions;
    const normalizedSearchTerm = this.normalizeText(searchTerm);

    return transactions.filter(t => {
      const statusPt = t.status === 'COMPLETED' ? 'concluido' : (t.status === 'PENDING' ? 'pendente' : '');
      const typePt = t.category?.type === 'INCOME' ? 'receita' : (t.category?.type === 'EXPENSE' ? 'despesa' : '');
      
      const formattedAmount = t.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.amount)) : '';
      const formattedEventDate = t.event_date ? displayDate(t.event_date) : '';
      const formattedEffectiveDate = t.effective_date ? displayDate(t.effective_date) : '';

      const subcategoryName = t.subcategory?.name || '';

      const fieldsToSearch = [
        t.description,
        String(t.amount),
        formattedAmount,
        statusPt,
        typePt,
        t.category?.name,
        subcategoryName,
        t.financial_institution?.name,
        t.card?.name,
        t.center?.name,
        t.supplier?.legal_name,
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
           if (!value || (Array.isArray(value) && value.length === 0)) return;
           const values = Array.isArray(value) ? value : [value];

           if (key === 'status') andFilters.push({ status: { in: values.map(String) } });
           if (['category_id', 'financial_institution_id', 'card_id', 'center_id', 'supplier_id', 'subcategory_id'].includes(key)) {
             andFilters.push({ [key]: { in: values.map(String) } });
           }
           if (key === 'type') {
             andFilters.push({ category: { type: value } });
           }
           if (key === 'description') {
             andFilters.push({ OR: values.map((v) => ({ description: { contains: String(v), mode: 'insensitive' } })) });
           }
           if (key === 'amount') {
             const amountCond = this.buildAmountRangeCondition(value);
             if (Object.keys(amountCond).length > 0) andFilters.push({ amount: amountCond });
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
        suppliers
      ] = await Promise.all([
        prisma.transaction.findMany({
          where,
          select: { description: true, status: true, amount: true },
          distinct: ['description', 'status', 'amount']
        }),
        prisma.category.findMany({ 
          where: { deleted_at: null }, 
          select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } 
        }),
        prisma.subcategory.findMany({ 
          where: { deleted_at: null }, 
          select: { id: true, name: true, category_id: true }, orderBy: { name: 'asc' } 
        }),
        prisma.financialInstitution.findMany({
          // Só instituições ativas aparecem como opção de filtro
          where: { deleted_at: null, is_active: true },
          select: { id: true, name: true }, orderBy: { name: 'asc' }
        }),
        prisma.card.findMany({ 
          where: { deleted_at: null }, 
          select: { id: true, name: true }, orderBy: { name: 'asc' } 
        }),
        prisma.center.findMany({ 
          where: { deleted_at: null }, 
          select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } 
        }),
        prisma.supplier.findMany({ 
          where: { deleted_at: null }, 
          select: { id: true, legal_name: true }, orderBy: { legal_name: 'asc' } 
        })
      ]);

      const uniqueDescriptions = Array.from(new Set(transactions.map(t => t.description).filter(Boolean))).sort();

      const statusOptions = [
        { value: 'PENDING', label: 'Pendente' },
        { value: 'COMPLETED', label: 'Concluído' }
      ];

      return {
        filters: [
          {
            field: 'category_id',
            type: 'select',
            label: 'Categoria',
            multiple: true,
            values: categories.map(c => ({ value: c.id, label: `${c.name} (${c.type === 'INCOME' ? 'Receita' : 'Despesa'})` }))
          },
          {
            field: 'subcategory_id',
            type: 'select',
            label: 'Subcategoria',
            multiple: true,
            dependsOn: { field: 'category_id', matchKey: 'category_id' },
            values: subcategories.map(s => ({ value: s.id, label: s.name, category_id: s.category_id }))
          },
          {
            field: 'financial_institution_id',
            type: 'select',
            label: 'Instituição Financeira',
            multiple: true,
            values: institutions.map(i => ({ value: i.id, label: i.name }))
          },
          {
            field: 'card_id',
            type: 'select',
            label: 'Cartão',
            multiple: true,
            values: cards.map(c => ({ value: c.id, label: c.name }))
          },
          {
            field: 'center_id',
            type: 'select',
            label: 'Centro',
            multiple: true,
            values: centers.map(c => ({ value: c.id, label: `${c.name}` }))
          },
          {
            field: 'supplier_id',
            type: 'select',
            label: 'Fornecedor',
            multiple: true,
            values: suppliers.map(s => ({ value: s.id, label: s.legal_name }))
          },
          {
            field: 'description',
            type: 'select',
            label: 'Descrição',
            multiple: true,
            values: uniqueDescriptions.map(d => ({ label: d, value: d })),
            searchable: true
          },
          {
            field: 'amount',
            type: 'number',
            label: 'Valor',
            numberRange: true
          },
          {
            field: 'status',
            type: 'select',
            label: 'Status',
            multiple: true,
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
        if (value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) {
          // Filtros de seleção aceitam 1 ou N valores (condição IN em ambos os casos).
          const values = Array.isArray(value) ? value : [value];

          if (key === 'status') where.status = { in: values.map(String) };
          if (['category_id', 'financial_institution_id', 'card_id', 'center_id', 'supplier_id', 'subcategory_id'].includes(key)) {
            where[key] = { in: values.map(String) };
          }
          if (key === 'type') {
            where.category = { type: value };
          }
          if (key === 'description') {
            where.OR = values.map((v) => ({ description: { contains: String(v), mode: 'insensitive' as Prisma.QueryMode } }));
          }
          if (key === 'amount') {
            const amountCond = this.buildAmountRangeCondition(value);
            if (Object.keys(amountCond).length > 0) where.amount = amountCond;
          }
          if (key === 'event_date' || key === 'effective_date') {
            where[key] = this.buildDateCondition(value);
          }
        }
      });

      let transactions: any[] = [];
      let total = 0;

      // Inclui a subcategoria diretamente da transação
      const includeConfig = { 
        category: true,
        subcategory: true,
        financial_institution: true, 
        card: true, 
        center: true,
        supplier: true
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
             const realField = this.RELATION_SORT_FIELDS[field] ?? field;
             
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
          filtered = filtered.sort((a, b) => parseLocalDate(b.event_date).getTime() - parseLocalDate(a.event_date).getTime());
        }
        
        transactions = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        
        Object.entries(sortOptions).forEach(([field, direction]) => {
          const dir = this.normalizeSortDirection(direction as string);
          
          if (['event_date', 'effective_date', 'amount', 'status', 'description', 'created_at'].includes(field)) {
            orderBy.push({ [field]: dir });
          } else if (this.RELATION_SORT_FIELDS[field]) {
            const [relation, relationField] = this.RELATION_SORT_FIELDS[field].split('.');
            orderBy.push({ [relation]: { [relationField]: dir } });
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

      // Usa a subcategoria diretamente da transação
      const mappedTransactions = transactions.map(t => ({
        ...t,
        subcategory: t.subcategory ? { name: t.subcategory.name } : { name: 'Nenhuma' }
      }));

      const aggregations = await prisma.transaction.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true }
      });

      // Saldos por tipo (Receita/Despesa). Lê category.type via relação.
      const sumByType = async (scope: any, type: 'INCOME' | 'EXPENSE'): Promise<number> => {
        const result = await prisma.transaction.aggregate({
          where: { ...scope, category: { ...(scope.category ?? {}), type } },
          _sum: { amount: true }
        });
        return Number(result._sum.amount ?? 0);
      };

      // Soma por tipo × status para o painel de Resumo. EXCLUI transferências
      // (is_transfer): suas pernas usam categorias internas de sistema e não
      // representam receita/despesa reais. Preserva eventual filtro de status já
      // aplicado pelo usuário (intersecção via AND), em vez de sobrescrevê-lo.
      const sumByTypeStatus = async (
        scope: any,
        type: 'INCOME' | 'EXPENSE',
        status: 'PENDING' | 'COMPLETED'
      ): Promise<number> => {
        const { status: scopeStatus, ...rest } = scope;
        const result = await prisma.transaction.aggregate({
          where: {
            ...rest,
            category: { ...(rest.category ?? {}), type },
            NOT: { is_transfer: true },
            AND: [
              ...(scopeStatus ? [{ status: scopeStatus }] : []),
              { status },
            ],
          },
          _sum: { amount: true }
        });
        return Number(result._sum.amount ?? 0);
      };

      // Saldo acumulado: ignora o início do período (mantém apenas o teto de data)
      // e preserva os demais filtros (instituição, etc.), somando desde o início.
      const accumulatedWhere: any = { ...where };
      for (const dateField of ['effective_date', 'event_date']) {
        const cond = accumulatedWhere[dateField];
        if (cond && typeof cond === 'object' && 'lte' in cond) {
          accumulatedWhere[dateField] = { lte: cond.lte };
        }
      }
      // Saldo acumulado considera somente lançamentos Concluídos (nunca Pendentes),
      // independentemente de filtro de status aplicado pelo usuário.
      accumulatedWhere.status = 'COMPLETED';

      const [
        periodIncome,
        periodExpense,
        accumulatedIncome,
        accumulatedExpense,
        receitasPrevisto,
        receitasRecebido,
        despesasPrevisto,
        despesasPago,
      ] = await Promise.all([
        sumByType(where, 'INCOME'),
        sumByType(where, 'EXPENSE'),
        sumByType(accumulatedWhere, 'INCOME'),
        sumByType(accumulatedWhere, 'EXPENSE'),
        sumByTypeStatus(where, 'INCOME', 'PENDING'),
        sumByTypeStatus(where, 'INCOME', 'COMPLETED'),
        sumByTypeStatus(where, 'EXPENSE', 'PENDING'),
        sumByTypeStatus(where, 'EXPENSE', 'COMPLETED'),
      ]);

      const totals = {
        periodIncome,
        periodExpense,
        periodBalance: periodIncome - periodExpense,
        accumulatedIncome,
        accumulatedExpense,
        accumulatedBalance: accumulatedIncome - accumulatedExpense,
        // Tipo × status (sem transferências) — usado pelo painel de Resumo.
        receitasPrevisto,
        receitasRecebido,
        despesasPrevisto,
        despesasPago,
      };

      return {
        data: mappedTransactions,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
        summary: aggregations,
        totals
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar lançamentos: ${error.message}`);
    }
  }

  static async getMonthlyIncomeExpenseSummary(year: number) {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const transactions = await prisma.transaction.findMany({
      where: {
        deleted_at: null,
        NOT: { is_transfer: true },
        event_date: { gte: startDate, lte: endDate },
      },
      select: {
        event_date: true,
        amount: true,
        category: { select: { type: true } },
      },
    });

    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));

    for (const transaction of transactions) {
      const monthIndex = transaction.event_date.getUTCMonth();
      const amount = Number(transaction.amount);

      if (transaction.category.type === 'INCOME') months[monthIndex].income += amount;
      else if (transaction.category.type === 'EXPENSE') months[monthIndex].expense += amount;
    }

    return { year, months };
  }

  static async getAvailableYears() {
    const transactions = await prisma.transaction.findMany({
      where: { deleted_at: null, NOT: { is_transfer: true } },
      select: { event_date: true },
    });

    const years = Array.from(new Set(transactions.map((t) => t.event_date.getUTCFullYear())));
    years.sort((a, b) => b - a);

    return { years };
  }

  static async getExpenseByCategory(startDate: Date, endDate: Date) {
    const baseWhere = {
      deleted_at: null,
      NOT: { is_transfer: true },
      event_date: { gte: startDate, lte: endDate },
    };

    const [incomeResult, categoryGroups] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...baseWhere, category: { type: 'INCOME' } },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['category_id'],
        where: { ...baseWhere, category: { type: 'EXPENSE' } },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = Number(incomeResult._sum.amount ?? 0);

    const categoryIds = categoryGroups.map((g) => g.category_id);
    const categoryNames = categoryIds.length > 0
      ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(categoryNames.map((c) => [c.id, c.name]));

    const categories = categoryGroups
      .map((g) => ({
        categoryId: g.category_id,
        name: nameById.get(g.category_id) ?? 'Sem categoria',
        value: Number(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.value - a.value);

    return { totalIncome, categories };
  }

  static async getSubcategoryBreakdown(categoryId: string, startDate: Date, endDate: Date) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, deleted_at: null },
      select: { id: true, name: true },
    });
    if (!category) throw new Error('Categoria não encontrada');

    const subcategoryGroups = await prisma.transaction.groupBy({
      by: ['subcategory_id'],
      where: {
        deleted_at: null,
        NOT: { is_transfer: true },
        category_id: categoryId,
        event_date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    const subcategoryIds = subcategoryGroups.map((g) => g.subcategory_id).filter((id): id is string => id !== null);
    const subcategoryNames = subcategoryIds.length > 0
      ? await prisma.subcategory.findMany({ where: { id: { in: subcategoryIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(subcategoryNames.map((s) => [s.id, s.name]));

    const subcategories = subcategoryGroups
      .map((g) => ({
        subcategoryId: g.subcategory_id,
        name: g.subcategory_id ? (nameById.get(g.subcategory_id) ?? 'Sem subcategoria') : 'Sem subcategoria',
        value: Number(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.value - a.value);

    const total = subcategories.reduce((sum, s) => sum + s.value, 0);

    return { categoryId: category.id, categoryName: category.name, total, subcategories };
  }

  static async getTransactionById(id: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id, deleted_at: null },
        include: { category: true, subcategory: true, financial_institution: true, card: true, center: true, supplier: true }
      });
      if (!transaction) throw new Error('Transaction not found');
      return transaction;
    } catch (error: any) { throw error; }
  }

  static async createTransaction(data: any, company_id: string) {
    try {
      const parseFK = (val: any) => (val === '' || val === 'null' || !val) ? null : val;

      let invoiceId: string | null = null;
      const cardId = parseFK(data.card_id);

      if (cardId && data.effective_date) {
        const { InvoiceService } = await import('./InvoiceService');
        const effectiveDate = parseLocalDate(data.effective_date);
        const invoiceMonth = effectiveDate.getMonth() + 1;
        const invoiceYear = effectiveDate.getFullYear();

        try {
          const invoice = await InvoiceService.findOrCreateInvoice(cardId, invoiceMonth, invoiceYear, company_id);
          invoiceId = invoice.id;
        } catch (error: any) {
          console.warn(`Não foi possível vincular à fatura: ${error.message}`);
        }
      }

      const transaction = await prisma.transaction.create({
        data: {
          event_date: parseLocalDate(data.event_date),
          effective_date: parseLocalDate(data.effective_date),
          description: data.description,
          amount: Number(data.amount),
          status: data.status || 'PENDING',
          category_id: data.category_id,
          subcategory_id: parseFK(data.subcategory_id),
          financial_institution_id: data.financial_institution_id,
          card_id: cardId,
          center_id: parseFK(data.center_id),
          supplier_id: parseFK(data.supplier_id),
          invoice_id: invoiceId,
          company_id,
        },
        include: { category: true, financial_institution: true, supplier: true }
      });

      // Atualizar total da fatura se vinculada
      if (invoiceId) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            total_amount: { increment: Number(data.amount) }
          }
        });
      }

      return transaction;
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

      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          event_date: data.event_date ? parseLocalDate(data.event_date) : undefined,
          effective_date: data.effective_date ? parseLocalDate(data.effective_date) : undefined,
          description: data.description,
          amount: data.amount !== undefined ? Number(data.amount) : undefined,
          status: data.status,
          category_id: data.category_id,
          subcategory_id: parseFKUpdate(data.subcategory_id),
          financial_institution_id: data.financial_institution_id,
          card_id: parseFKUpdate(data.card_id),
          center_id: parseFKUpdate(data.center_id),
          supplier_id: parseFKUpdate(data.supplier_id)
        },
        include: { category: true, financial_institution: true, supplier: true }
      });

      // Cascata do par de transferência: espelha os campos financeiramente
      // relevantes (valor, datas, status) na outra perna. Categoria, instituição
      // e descrição são específicas de cada perna e por isso não são espelhadas.
      if (existing.is_transfer && existing.transfer_group_id) {
        await prisma.transaction.updateMany({
          where: {
            transfer_group_id: existing.transfer_group_id,
            id: { not: id },
            deleted_at: null
          },
          data: {
            amount: data.amount !== undefined ? Number(data.amount) : undefined,
            event_date: data.event_date ? parseLocalDate(data.event_date) : undefined,
            effective_date: data.effective_date ? parseLocalDate(data.effective_date) : undefined,
            status: data.status
          }
        });
      }

      // Propagação de reajuste de valor para as parcelas/ocorrências SEGUINTES
      // da mesma série. Só dispara quando o valor mudou e o cliente pediu
      // (`propagate_to_following`). Parcelas já concluídas (COMPLETED) são
      // preservadas. Funciona igual para débito e crédito (o sinal vem no amount).
      const newAmount = data.amount !== undefined ? Number(data.amount) : undefined;
      const amountChanged = newAmount !== undefined && Number(existing.amount) !== newAmount;

      if (data.propagate_to_following === true && amountChanged) {
        if (existing.installment_group_id && existing.installment_number != null) {
          await prisma.transaction.updateMany({
            where: {
              installment_group_id: existing.installment_group_id,
              installment_number: { gt: existing.installment_number },
              status: 'PENDING',
              deleted_at: null
            },
            data: { amount: newAmount }
          });
        } else if (existing.recurring_group_id && existing.occurrence_number != null) {
          await prisma.transaction.updateMany({
            where: {
              recurring_group_id: existing.recurring_group_id,
              occurrence_number: { gt: existing.occurrence_number },
              status: 'PENDING',
              deleted_at: null
            },
            data: { amount: newAmount }
          });
        }
      }

      return updated;
    } catch (error: any) { throw error; }
  }

  static async deleteTransaction(id: string) {
    try {
      const transaction = await prisma.transaction.findUnique({ where: { id, deleted_at: null } });
      if (!transaction) throw new Error('Transaction not found or already deleted');

      const now = new Date();

      // Cascata do par de transferência: excluir uma perna remove ambas.
      if (transaction.is_transfer && transaction.transfer_group_id) {
        await prisma.transaction.updateMany({
          where: { transfer_group_id: transaction.transfer_group_id, deleted_at: null },
          data: { deleted_at: now }
        });
      } else {
        await prisma.transaction.update({
          where: { id },
          data: { deleted_at: now }
        });
      }

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

  static async createInstallments(data: any, company_id: string) {
    try {
      const parseFK = (val: any) => (val === '' || val === 'null' || !val) ? null : val;
      const parseAmount = (val: any): number => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const clean = val.replace(/[R$\s]/g, '').replace(',', '.');
          const parsed = parseFloat(clean);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      const installmentAmount = parseAmount(data.installment_amount);
      const numInstallments = Number(data.num_installments);
      const totalAmount = parseAmount(data.total_amount);

      const firstPaymentDate = new Date(data.first_payment_date);
      const startDate = new Date(data.start_date);

      // === VALIDAÇÕES (além das do validator) ===
      if (numInstallments < 2 || numInstallments > 120) {
        throw new Error('Número de parcelas deve estar entre 2 e 120');
      }

      if (installmentAmount <= 0) {
        throw new Error('Valor da parcela deve ser maior que zero');
      }

      const expectedTotal = installmentAmount * numInstallments;
      if (Math.abs(totalAmount - expectedTotal) > 0.01) {
        throw new Error(`Total inválido: esperado ${expectedTotal.toFixed(2)}, recebido ${totalAmount.toFixed(2)}`);
      }

      if (firstPaymentDate < startDate) {
        throw new Error('Data do primeiro pagamento deve ser igual ou posterior à data inicial');
      }

      // === CÁLCULO DAS DATAS ===
      // Datas de vencimento (effective_date) para cada parcela
      const installmentDates: Date[] = [];
      for (let i = 0; i < numInstallments; i++) {
        const date = new Date(firstPaymentDate);
        date.setMonth(date.getMonth() + i);
        if (date.getDate() !== firstPaymentDate.getDate()) {
          date.setDate(0);
        }
        installmentDates.push(date);
      }

      // === CRIAÇÃO DAS PARCELAS (v4: APENAS parcelas, SEM transação pai) ===
      const transactionType = data.transaction_type || 'EXPENSE';
      const label = transactionType === 'INCOME' ? 'Receita' : 'Parcela';

      // Chave de série compartilhada por todas as parcelas — permite propagar
      // reajuste de valor para as parcelas seguintes ao editar uma delas.
      const installmentGroupId = randomUUID();

      // Import dinâmico para evitar dependência circular
      const { InvoiceService } = await import('./InvoiceService');

      const installments = await prisma.$transaction(
        async (tx) => {
          const createdInstallments = [];

          // Data do evento e data da compra - IGUAIS para todas as parcelas
          const constantEventDate = new Date(startDate);
          const constantPurchaseDate = new Date(startDate);

          for (let index = 0; index < numInstallments; index++) {
            const installmentNumber = index + 1;
            // effective_date varia (vencimento de cada parcela)
            const effectiveDate = installmentDates[index];

            // event_date e purchase_date CONSTANTES em todas as parcelas
            const eventDate = parseLocalDate(constantEventDate);

            // Calcular mês/ano da fatura baseado na effective_date (vencimento)
            const invoiceMonth = effectiveDate.getMonth() + 1;
            const invoiceYear = effectiveDate.getFullYear();

            console.log(`📅 Parcela ${installmentNumber}/${numInstallments}: event_date=${eventDate.toLocaleDateString('pt-BR')}, purchase_date=${constantPurchaseDate.toLocaleDateString('pt-BR')}, effective_date=${effectiveDate.toLocaleDateString('pt-BR')}`);
            
            // Buscar ou criar fatura automaticamente se houver card_id
            let invoiceId: string | null = null;
            const cardId = parseFK(data.card_id);
            
            if (cardId) {
              try {
                const invoice = await InvoiceService.findOrCreateInvoice(
                  cardId,
                  invoiceMonth,
                  invoiceYear,
                  company_id
                );
                invoiceId = invoice.id;
                console.log(`[DEBUG createInstallments] Parcela ${installmentNumber}/${numInstallments} vinculada à fatura ${invoiceId} (${invoiceMonth}/${invoiceYear})`);
              } catch (error: any) {
                // Se fatura estiver fechada/paga, lançar erro
                if (error.message.includes('Fatura de')) {
                  throw error;
                }
                // Outros erros, continuar sem vincular
                console.warn(`[DEBUG] Não foi possível vincular parcela à fatura: ${error.message}`);
              }
            }

            const transaction = await tx.transaction.create({
              data: {
                installment_number: installmentNumber,
                total_installments: numInstallments,
                installment_group_id: installmentGroupId,
                amount: installmentAmount,
                description: data.description
                  ? `${data.description} - ${label} ${installmentNumber}/${numInstallments}`
                  : `${label} ${installmentNumber}/${numInstallments}`,
                event_date: eventDate,
                effective_date: effectiveDate,
                purchase_date: constantPurchaseDate,
                category_id: data.category_id,
                subcategory_id: parseFK(data.subcategory_id),
                financial_institution_id: data.institution_id,
                card_id: cardId,
                center_id: parseFK(data.center_id),
                supplier_id: transactionType === 'EXPENSE' ? parseFK(data.supplier_id) : null,
                invoice_id: invoiceId,
                status: 'PENDING',
                payment_mode: 'PARCELADO',
                company_id,
              },
              include: { category: true, financial_institution: true, supplier: true }
            });

            createdInstallments.push(transaction);

            // Atualizar total da fatura se vinculada
            if (invoiceId) {
              await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                  total_amount: { increment: installmentAmount }
                }
              });
            }
          }

          return createdInstallments;
        }
      );

      return {
        success: true,
        message: `${numInstallments} ${label.toLowerCase()}s de R$ ${installmentAmount.toFixed(2)} criadas com sucesso`,
        data: {
          num_installments: numInstallments,
          installment_amount: installmentAmount,
          total_amount: expectedTotal,
          installments: installments.map((inst: any) => ({
            id: inst.id,
            installment_number: inst.installment_number,
            amount: inst.amount,
            effective_date: inst.effective_date,
            description: inst.description,
            status: inst.status,
            invoice_id: inst.invoice_id
          }))
        },
        validation: {
          sum_of_installments: expectedTotal,
          expected_total: totalAmount,
          matches: true
        }
      };
    } catch (error: any) { throw error; }
  }

  static async createRecurring(data: any, company_id: string) {
    try {
      const parseFK = (val: any) => (val === '' || val === 'null' || !val) ? null : val;
      const parseAmount = (val: any): number => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const clean = val.replace(/[R$\s]/g, '').replace(',', '.');
          const parsed = parseFloat(clean);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      const amount = parseAmount(data.amount);
      const numOccurrences = Number(data.num_installments);
      const startDate = new Date(data.start_date);
      const firstPaymentDate = new Date(data.first_payment_date);

      // === VALIDAÇÕES ===
      if (numOccurrences < 2 || numOccurrences > 120) {
        throw new Error('Número de lançamentos deve estar entre 2 e 120');
      }

      if (amount <= 0) {
        throw new Error('Valor deve ser maior que zero');
      }

      if (firstPaymentDate < startDate) {
        throw new Error('Data de primeiro pagamento deve ser igual ou posterior à data inicial');
      }

      // === CÁLCULO DAS DATAS (MENSAL - fixo) ===
      const occurrenceDates: Date[] = [];
      for (let i = 0; i < numOccurrences; i++) {
        const date = new Date(firstPaymentDate);
        date.setMonth(date.getMonth() + i);
        if (date.getDate() !== firstPaymentDate.getDate()) {
          date.setDate(0);
        }
        occurrenceDates.push(date);
      }

      // === CRIAÇÃO DOS LANÇAMENTOS (v4: APENAS os lançamentos, SEM config pai) ===
      const occurrences = await prisma.$transaction(
        Array.from({ length: numOccurrences }, (_, index) => {
          const occurrenceNumber = index + 1;

          return prisma.transaction.create({
            data: {
              installment_number: occurrenceNumber,
              total_installments: numOccurrences,
              amount: amount,
              description: data.description
                ? `${data.description} - Recorrente ${occurrenceNumber}/${numOccurrences}`
                : `Gasto Recorrente ${occurrenceNumber}/${numOccurrences}`,
              event_date: parseLocalDate(startDate),
              effective_date: parseLocalDate(occurrenceDates[index]),
              category_id: data.category_id,
              subcategory_id: parseFK(data.subcategory_id),
              financial_institution_id: data.institution_id,
              card_id: parseFK(data.card_id),
              center_id: parseFK(data.center_id),
              supplier_id: parseFK(data.supplier_id),
              is_recurring: true,
              recurring_frequency: 'MONTHLY',
              status: 'PENDING',
              payment_mode: 'RECORRENTE',
              company_id,
            },
            include: { category: true, financial_institution: true, supplier: true }
          });
        })
      );

      return {
        success: true,
        message: `${numOccurrences} gastos recorrentes criados com sucesso`,
        data: {
          num_occurrences: numOccurrences,
          amount: amount,
          occurrences: occurrences.map((occ: any) => ({
            id: occ.id,
            occurrence_number: occ.installment_number,
            amount: occ.amount,
            effective_date: occ.effective_date,
            description: occ.description,
            status: occ.status,
          })),
        },
      };
    } catch (error: any) { throw error; }
  }

  static async generateNextRecurring(params: any) {
    try {
      const monthsAhead = params.months_ahead || 3;
      const targetDate = params.target_date ? new Date(params.target_date) : new Date();
      const cutoffDate = new Date(targetDate);
      cutoffDate.setMonth(cutoffDate.getMonth() + monthsAhead);

      // Buscar configurações ativas
      const activeConfigs = await prisma.recurringConfig.findMany({
        where: {
          is_active: true,
          OR: [
            { end_date: null },
            { end_date: { gte: targetDate } }
          ]
        }
      });

      const details: any[] = [];
      let totalGenerated = 0;

      for (const config of activeConfigs) {
        // Buscar última ocorrência gerada
        const lastOccurrence = await prisma.transaction.findFirst({
          where: { recurring_group_id: config.id },
          orderBy: { occurrence_number: 'desc' }
        });

        let nextOccurrenceNumber = lastOccurrence
          ? (lastOccurrence.occurrence_number || 0) + 1
          : 1;

        let currentDate = lastOccurrence
          ? this.getNextDate(parseLocalDate(lastOccurrence.effective_date), config.frequency)
          : parseLocalDate(config.start_date);

        let eventDate = lastOccurrence
          ? this.getNextDate(parseLocalDate(lastOccurrence.event_date), config.frequency)
          : parseLocalDate(config.start_date);

        const newOccurrences = [];

        // Verificar se atingiu limite
        const shouldStop = () => {
          if (config.total_occurrences && nextOccurrenceNumber > config.total_occurrences) return true;
          if (config.end_date && currentDate > config.end_date) return true;
          if (currentDate > cutoffDate) return true;
          return false;
        };

        while (!shouldStop()) {
          const occurrence = await prisma.transaction.create({
            data: {
              event_date: parseLocalDate(eventDate),
              effective_date: parseLocalDate(currentDate),
              description: config.description,
              amount: config.amount,
              status: 'PENDING',
              category_id: config.category_id,
              financial_institution_id: config.financial_institution_id,
              card_id: config.card_id,
              center_id: config.center_id,
              supplier_id: config.supplier_id,
              is_recurring: true,
              recurring_group_id: config.id,
              recurring_frequency: config.frequency,
              occurrence_number: nextOccurrenceNumber,
              payment_mode: 'RECORRENTE',
              company_id: config.company_id,
            }
          });

          newOccurrences.push(occurrence);

          nextOccurrenceNumber++;
          currentDate = this.getNextDate(currentDate, config.frequency);
          eventDate = this.getNextDate(eventDate, config.frequency);
        }

        if (newOccurrences.length > 0) {
          // Atualizar contador
          await prisma.recurringConfig.update({
            where: { id: config.id },
            data: {
              generated_occurrences: { increment: newOccurrences.length },
              next_generation_date: cutoffDate
            }
          });

          details.push({
            recurring_group_id: config.id,
            new_occurrences: newOccurrences.length
          });

          totalGenerated += newOccurrences.length;
        }
      }

      return {
        generated: totalGenerated,
        details
      };
    } catch (error: any) { throw error; }
  }

  private static getNextDate(date: Date, frequency: string): Date {
    const newDate = new Date(date);
    switch (frequency) {
      case 'WEEKLY':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'MONTHLY':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        newDate.setMonth(newDate.getMonth() + 3);
        break;
      case 'YEARLY':
        newDate.setFullYear(newDate.getFullYear() + 1);
        break;
    }
    return newDate;
  }

  // ==========================================
  // MÉTODOS PARA GERENCIAMENTO DE GRUPOS
  // ==========================================

  static async getRelatedTransactions(id: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id, deleted_at: null },
        include: {
          category: true,
          financial_institution: true,
          supplier: true,
          child_transactions: {
            where: { deleted_at: null },
            orderBy: { installment_number: 'asc' }
          }
        }
      });

      if (!transaction) throw new Error('Transaction not found');

      // Se tem parent_transaction_id, buscar o pai e todas as irmãs
      if (transaction.parent_transaction_id) {
        const parent = await prisma.transaction.findUnique({
          where: { id: transaction.parent_transaction_id },
          include: {
            child_transactions: {
              where: { deleted_at: null },
              orderBy: { installment_number: 'asc' }
            }
          }
        });

        return {
          parent: {
            id: parent?.id,
            type: parent?.payment_mode,
            total_amount: parent?.amount,
            total_installments: parent?.total_installments
          },
          related_transactions: parent?.child_transactions || []
        };
      }

      // Se tem recurring_group_id, buscar todas as ocorrências
      if (transaction.recurring_group_id) {
        const occurrences = await prisma.transaction.findMany({
          where: {
            recurring_group_id: transaction.recurring_group_id,
            deleted_at: null
          },
          orderBy: { occurrence_number: 'asc' }
        });

        const config = await prisma.recurringConfig.findUnique({
          where: { id: transaction.recurring_group_id }
        });

        return {
          parent: {
            id: transaction.recurring_group_id,
            type: 'RECORRENTE',
            total_amount: transaction.amount,
            total_installments: config?.total_occurrences
          },
          related_transactions: occurrences
        };
      }

      // Se tem filhos, é um pai
      if (transaction.child_transactions && transaction.child_transactions.length > 0) {
        return {
          parent: {
            id: transaction.id,
            type: transaction.payment_mode,
            total_amount: transaction.amount,
            total_installments: transaction.total_installments
          },
          related_transactions: transaction.child_transactions
        };
      }

      // Transação simples sem relacionamentos
      return {
        parent: null,
        related_transactions: []
      };
    } catch (error: any) { throw error; }
  }

  static async deleteTransactionGroup(groupId: string, mode: 'ALL' | 'FUTURE' | 'ONLY_PENDING') {
    try {
      const now = new Date();
      let whereClause: any = {};

      // Determinar se é uma transação pai ou grupo de recorrência
      const parentTransaction = await prisma.transaction.findUnique({
        where: { id: groupId }
      });

      const recurringConfig = await prisma.recurringConfig.findUnique({
        where: { id: groupId }
      });

      if (parentTransaction?.payment_mode === 'PARCELADO') {
        // Deletar grupo de parcelas
        switch (mode) {
          case 'ALL':
            whereClause = { parent_transaction_id: groupId };
            break;
          case 'FUTURE':
            whereClause = {
              parent_transaction_id: groupId,
              effective_date: { gt: now }
            };
            break;
          case 'ONLY_PENDING':
            whereClause = {
              parent_transaction_id: groupId,
              status: 'PENDING'
            };
            break;
        }

        const [updatedCount] = await prisma.$transaction([
          prisma.transaction.updateMany({
            where: { ...whereClause, deleted_at: null },
            data: { deleted_at: now }
          })
        ]);

        // Se deletou todas, marcar o pai também
        if (mode === 'ALL') {
          await prisma.transaction.update({
            where: { id: groupId },
            data: { deleted_at: now }
          });
        }

        return { deleted_count: updatedCount.count };
      }

      if (recurringConfig || parentTransaction?.is_recurring) {
        const configId = recurringConfig?.id || parentTransaction?.recurring_group_id;

        switch (mode) {
          case 'ALL':
            whereClause = { recurring_group_id: configId };
            break;
          case 'FUTURE':
            whereClause = {
              recurring_group_id: configId,
              effective_date: { gt: now }
            };
            break;
          case 'ONLY_PENDING':
            whereClause = {
              recurring_group_id: configId,
              status: 'PENDING'
            };
            break;
        }

        const [updatedCount] = await prisma.$transaction([
          prisma.transaction.updateMany({
            where: { ...whereClause, deleted_at: null },
            data: { deleted_at: now }
          })
        ]);

        // Se deletou todas, desativar a configuração
        if (mode === 'ALL' && configId) {
          await prisma.recurringConfig.update({
            where: { id: configId },
            data: { is_active: false, deleted_at: now }
          });
        }

        return { deleted_count: updatedCount.count };
      }

      throw new Error('Group not found or invalid');
    } catch (error: any) { throw error; }
  }
}