import { ApiResponse } from '../utils/api-response';
import prisma from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { parseLocalDate, displayDate } from '../utils/date-utils';

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
           if (!value) return;
           if (key === 'status') andFilters.push({ status: value });
           if (['category_id', 'financial_institution_id', 'card_id', 'center_id', 'supplier_id'].includes(key)) {
             andFilters.push({ [key]: String(value) });
           }
           // Filtra diretamente pelo subcategory_id da transação
           if (key === 'subcategory_id') {
              andFilters.push({ subcategory_id: String(value) });
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
          where: { deleted_at: null }, 
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
            field: 'category_id', 
            type: 'select', 
            label: 'Categoria', 
            values: categories.map(c => ({ value: c.id, label: `${c.name} (${c.type === 'INCOME' ? 'Receita' : 'Despesa'})` })) 
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
            values: centers.map(c => ({ value: c.id, label: `${c.name}` })) 
          },
          { 
            field: 'supplier_id', 
            type: 'select', 
            label: 'Fornecedor', 
            values: suppliers.map(s => ({ value: s.id, label: s.legal_name })) 
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
          if (['category_id', 'financial_institution_id', 'card_id', 'center_id', 'supplier_id'].includes(key)) {
            where[key] = String(value);
          }
          if (key === 'subcategory_id') {
            where.subcategory_id = String(value);
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
          filtered = filtered.sort((a, b) => parseLocalDate(b.event_date).getTime() - parseLocalDate(a.event_date).getTime());
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
            orderBy.push({ subcategory: { name: dir } });
          } else if (field === 'financial_institution_id') {
            orderBy.push({ financial_institution: { name: dir } });
          } else if (field === 'card_id') {
            orderBy.push({ card: { name: dir } });
          } else if (field === 'center_id') {
            orderBy.push({ center: { name: dir } });
          } else if (field === 'supplier_id') {
            orderBy.push({ supplier: { legal_name: dir } });
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
        include: { category: true, subcategory: true, financial_institution: true, card: true, center: true, supplier: true }
      });
      if (!transaction) throw new Error('Transaction not found');
      return transaction;
    } catch (error: any) { throw error; }
  }

  static async createTransaction(data: any) {
    try {
      const parseFK = (val: any) => (val === '' || val === 'null' || !val) ? null : val;

      // Se tem cartão, vincular à fatura do mês
      let invoiceId: string | null = null;
      const cardId = parseFK(data.card_id);
      
      if (cardId && data.effective_date) {
        const { InvoiceService } = await import('./InvoiceService');
        const effectiveDate = parseLocalDate(data.effective_date);
        const invoiceMonth = effectiveDate.getMonth() + 1;
        const invoiceYear = effectiveDate.getFullYear();
        
        try {
          const invoice = await InvoiceService.findOrCreateInvoice(
            cardId,
            invoiceMonth,
            invoiceYear
          );
          invoiceId = invoice.id;
        } catch (error: any) {
          // Se fatura estiver fechada/paga, apenas avisa no console
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
          invoice_id: invoiceId
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

      return await prisma.transaction.update({
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

  static async createInstallments(data: any) {
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
                  invoiceYear
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

  static async createRecurring(data: any) {
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
                ? `${data.description} - ${occurrenceNumber}/${numOccurrences}`
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
              payment_mode: 'RECORRENTE'
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