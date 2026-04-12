import prisma from '../lib/prisma';
import type { 
  CreateInvoiceInput, 
  UpdateInvoiceStatusInput, 
  GetInvoiceParams,
  InvoiceWithRelations 
} from '../types/invoice';

export class InvoiceService {
  
  // Buscar fatura por cartão, mês e ano
  static async getInvoice(params: GetInvoiceParams): Promise<InvoiceWithRelations | null> {
    const { cardId, month, year } = params;

    console.log('[DEBUG getInvoice] Buscando fatura:', { cardId, month, year, monthType: typeof month, yearType: typeof year });

    const invoice = await prisma.invoice.findUnique({
      where: {
        card_id_month_year: { card_id: cardId, month, year }
      },
      include: {
        card: {
          select: {
            id: true,
            name: true,
            brand: true,
            limit: true,
            closing_day: true,
            due_day: true
          }
        },
        transactions: {
          where: { deleted_at: null },
          orderBy: { event_date: 'asc' },
          include: {
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, legal_name: true } }
          }
        }
      }
    });

    if (!invoice) {
      console.log('[DEBUG getInvoice] Fatura NÃO encontrada');
      return null;
    }
    console.log('[DEBUG getInvoice] Fatura encontrada:', { id: invoice.id, status: invoice.status, transactionsCount: invoice.transactions.length });

    // ✅ CALCULAR total baseado nas transações
    const calculatedTotal = invoice.transactions.reduce(
      (sum, t) => sum + (Number(t.amount) || 0),
      0
    );

    // Atualizar total_amount se estiver diferente
    if (calculatedTotal !== Number(invoice.total_amount)) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { total_amount: calculatedTotal }
      });
      (invoice.total_amount as any) = calculatedTotal;
    }

    return invoice as unknown as InvoiceWithRelations;
  }

  // Criar nova fatura
  static async createInvoice(data: CreateInvoiceInput) {
    const { card_id, month, year, closing_date, due_date } = data;

    // Verificar se o cartão existe
    const card = await prisma.card.findUnique({
      where: { id: card_id }
    });

    if (!card) {
      throw new Error('Cartão não encontrado');
    }

    // Verificar se fatura já existe
    const existingInvoice = await prisma.invoice.findUnique({
      where: {
        card_id_month_year: { card_id, month, year }
      }
    });

    if (existingInvoice) {
      throw new Error(`Fatura já existe para ${month}/${year}`);
    }

    // Calcular datas automaticamente se não fornecidas
    let finalClosingDate: Date;
    let finalDueDate: Date;

    if (closing_date) {
      finalClosingDate = new Date(closing_date);
    } else {
      finalClosingDate = new Date(year, month - 1, card.closing_day ?? 1);
    }

    if (due_date) {
      finalDueDate = new Date(due_date);
    } else {
      finalDueDate = new Date(year, month - 1, card.due_day ?? 10);
      // Se a data de vencimento for anterior ao fechamento, adicionar 1 mês
      if (finalDueDate < finalClosingDate) {
        finalDueDate.setMonth(finalDueDate.getMonth() + 1);
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        card_id,
        month,
        year,
        closing_date: finalClosingDate,
        due_date: finalDueDate,
        total_amount: 0,
        paid_amount: 0,
        status: 'PENDING'
      },
      include: {
        card: {
          select: {
            id: true,
            name: true,
            brand: true,
            limit: true,
            closing_day: true,
            due_day: true
          }
        }
      }
    });

    return invoice;
  }

  // Atualizar status da fatura (APENAS atualiza, sem criar lançamento)
  static async updateStatus(id: string, data: UpdateInvoiceStatusInput) {
    const { status, effective_date, paid_amount } = data;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        card: true,
        transactions: {
          where: { deleted_at: null },
          select: { amount: true }
        }
      }
    });

    if (!invoice) {
      throw new Error('Fatura não encontrada');
    }

    // Validar transições de status
    const currentStatus = invoice.status as string;
    
    if (currentStatus === 'COMPLETED' && status !== 'COMPLETED') {
      throw new Error('Não é possível alterar o status de uma fatura já concluída');
    }

    const updateData: any = { status };

    // Se está sendo marcada como COMPLETED, apenas atualiza os campos
    if (status === 'COMPLETED') {
      updateData.paid_date = effective_date ? new Date(effective_date) : new Date();
      // Calcular total baseado nas transações (mais confiável que total_amount do banco)
      const calculatedTotal = invoice.transactions.reduce(
        (sum, t) => sum + (Number(t.amount) || 0),
        0
      );
      const currentTotal = calculatedTotal || Number(invoice.total_amount) || 0;
      // Só usar paid_amount do frontend se for um número válido > 0
      const frontendAmount = Number(paid_amount);
      updateData.paid_amount = (frontendAmount > 0) ? frontendAmount : currentTotal;
      
      // DEBUG: Log dos valores
      console.log('[DEBUG updateStatus]', {
        invoiceId: id,
        transactionsCount: invoice.transactions.length,
        calculatedTotal,
        invoiceTotalAmount: invoice.total_amount,
        currentTotal,
        frontendAmount,
        finalPaidAmount: updateData.paid_amount
      });
      
      // Atualizar todas as transações vinculadas para COMPLETED
      await prisma.transaction.updateMany({
        where: { 
          invoice_id: id,
          deleted_at: null
        },
        data: { 
          status: 'COMPLETED'
        }
      });
      console.log(`[DEBUG] Transações da fatura ${id} atualizadas para COMPLETED`);
    }

    // Se está sendo reaberta (COMPLETED -> PENDING)
    if (currentStatus === 'COMPLETED' && status === 'PENDING') {
      updateData.paid_date = null;
      updateData.paid_amount = 0;
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        card: {
          select: {
            id: true,
            name: true,
            brand: true,
            limit: true,
            closing_day: true,
            due_day: true
          }
        }
      }
    });

    return updatedInvoice;
  }

  // Criar transação de pagamento da fatura
  private static async createPaymentTransaction(
    invoice: any, 
    institutionId: string, 
    paidDate: Date, 
    paidAmount: number
  ) {
    // Buscar ou criar categoria "Pagamento de Cartão"
    let category = await prisma.category.findFirst({
      where: { 
        name: { contains: 'Pagamento de Cartão', mode: 'insensitive' },
        type: 'EXPENSE'
      }
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'Pagamento de Cartão',
          type: 'EXPENSE',
          is_system: true
        }
      });
    }

    // Criar a transação de despesa
    await prisma.transaction.create({
      data: {
        description: `Pagamento fatura ${invoice.card.name} - ${String(invoice.month).padStart(2, '0')}/${invoice.year}`,
        amount: paidAmount,
        event_date: paidDate,
        effective_date: paidDate,
        status: 'COMPLETED',
        category_id: category.id,
        financial_institution_id: institutionId,
        card_id: invoice.card_id,
        invoice_id: invoice.id
      }
    });
  }

  // Listar transações de uma fatura
  static async getInvoiceTransactions(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      throw new Error('Fatura não encontrada');
    }

    const transactions = await prisma.transaction.findMany({
      where: { 
        invoice_id: invoiceId,
        deleted_at: null
      },
      orderBy: { event_date: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, legal_name: true } }
      }
    });

    return transactions;
  }

  // Buscar ou criar fatura automaticamente
  static async findOrCreateInvoice(
    cardId: string, 
    month: number, 
    year: number
  ) {
    // Tentar buscar fatura existente
    let invoice = await prisma.invoice.findUnique({
      where: {
        card_id_month_year: { card_id: cardId, month, year }
      }
    });

    // Se não existe, criar automaticamente
    if (!invoice) {
      invoice = await this.createInvoice({
        card_id: cardId,
        month,
        year
      });
    }

    // Retorna a fatura independente do status
    return invoice;
  }

  // Atualizar total da fatura após adicionar/remover transação
  static async updateInvoiceTotal(invoiceId: string, amountChange: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      throw new Error('Fatura não encontrada');
    }

    const currentTotal = Number(invoice.total_amount);
    const newTotal = currentTotal + amountChange;

    if (newTotal < 0) {
      throw new Error('Total da fatura não pode ser negativo');
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { total_amount: newTotal },
      include: {
        card: {
          select: {
            id: true,
            name: true,
            brand: true,
            limit: true,
            closing_day: true,
            due_day: true
          }
        }
      }
    });

    return updatedInvoice;
  }

  // Listar faturas por cartão
  static async getInvoicesByCard(cardId: string, year?: number) {
    const where: any = { card_id: cardId };
    
    if (year) {
      where.year = year;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      include: {
        card: {
          select: {
            id: true,
            name: true,
            brand: true,
            limit: true,
            closing_day: true,
            due_day: true
          }
        },
        _count: {
          select: { transactions: { where: { deleted_at: null } } }
        }
      }
    });

    return invoices.map(inv => ({
      ...inv,
      transaction_count: inv._count.transactions
    }));
  }
}
