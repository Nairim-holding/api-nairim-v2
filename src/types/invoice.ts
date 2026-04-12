// Tipo auxiliar para Decimal do Prisma
type Decimal = any;

export interface Invoice {
  id: string;
  card_id: string;
  month: number;
  year: number;
  total_amount: number | Decimal;
  status: 'OPEN' | 'CLOSED' | 'PAID';
  closing_date: Date | null;
  due_date: Date | null;
  paid_date: Date | null;
  paid_amount: number | Decimal;
  institution_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface InvoiceWithRelations extends Invoice {
  card: {
    id: string;
    name: string;
    brand: string;
    limit: number | Decimal;
    closing_day: number | null;
    due_day: number | null;
  };
  transactions: InvoiceTransaction[];
}

export interface InvoiceTransaction {
  id: string;
  description: string;
  amount: number | Decimal;
  event_date: Date;
  effective_date: Date;
  status: 'PENDING' | 'COMPLETED';
  installment_number?: number | null;
  total_installments?: number | null;
  category?: {
    id: string;
    name: string;
  };
  supplier?: {
    id: string;
    legal_name: string;
  } | null;
}

export interface CreateInvoiceInput {
  card_id: string;
  month: number;
  year: number;
  closing_date?: string;
  due_date?: string;
}

export interface UpdateInvoiceStatusInput {
  status: 'PENDING' | 'COMPLETED';
  effective_date?: string;
  paid_amount?: number;
}

export interface GetInvoiceParams {
  cardId: string;
  month: number;
  year: number;
}

export interface InvoiceSummary {
  total_amount: number;
  transaction_count: number;
  paid_amount?: number;
}
