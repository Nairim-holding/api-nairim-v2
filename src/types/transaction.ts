export interface Transaction {
  id: string;
  event_date: Date;
  effective_date: Date;
  description: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED';
  category_id: string;
  subcategory_id?: string | null;
  financial_institution_id: string;
  card_id?: string | null;
  center_id?: string | null;
  supplier_id?: string | null;
  // Campos para parcelamento e recorrência
  parent_transaction_id?: string | null;
  installment_number?: number | null;
  total_installments?: number | null;
  is_recurring: boolean;
  recurring_group_id?: string | null;
  recurring_frequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | null;
  occurrence_number?: number | null;
  payment_mode?: 'PARCELADO' | 'RECORRENTE' | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateTransactionInput {
  event_date: string | Date;
  effective_date: string | Date;
  description: string;
  amount: number;
  status?: 'PENDING' | 'COMPLETED';
  category_id: string;
  subcategory_id?: string;
  financial_institution_id: string;
  card_id?: string;
  center_id?: string;
  supplier_id?: string;
}

export interface UpdateTransactionInput {
  event_date?: string | Date;
  effective_date?: string | Date;
  description?: string;
  amount?: number;
  status?: 'PENDING' | 'COMPLETED';
  category_id?: string;
  subcategory_id?: string | null;
  financial_institution_id?: string;
  card_id?: string | null;
  center_id?: string | null;
  supplier_id?: string | null;
}

export interface GetTransactionsParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  filters?: Record<string, any>;
  includeInactive?: boolean;
}

// Interfaces para lançamentos parcelados (v4)
export interface CreateInstallmentsInput {
  transaction_type: 'EXPENSE' | 'INCOME';  // v4: Suporta ambos
  payment_mode: 'PARCELADO';
  institution_id: string;
  category_id: string;
  subcategory_id?: string;
  center_id?: string;
  supplier_id?: string;
  description?: string;  // v4: Opcional
  // v2: Usuário insere valor DA PARCELA, não total
  installment_amount: number | string;  // Valor de cada parcela (ex: 100.00)
  num_installments: number;               // Quantidade de parcelas (ex: 12)
  total_amount: number | string;          // Total calculado para validação (ex: 1200.00)
  start_date: string;                     // Data do evento (YYYY-MM-DD)
  first_payment_date: string;             // Data do primeiro pagamento (YYYY-MM-DD)
  parent_transaction_id?: string | null;
}

export interface InstallmentOutput {
  id: string;
  installment_number: number;
  event_date: Date;
  effective_date: Date;
  amount: number;
  description: string;
  status: string;
  parent_id: string | null;
}

export interface CreateInstallmentsOutput {
  parent_transaction_id: string;
  installments: InstallmentOutput[];
}

// Interfaces para lançamentos recorrentes (v4)
export interface CreateRecurringInput {
  transaction_type: 'EXPENSE';  // v4: Apenas EXPENSE
  payment_mode: 'RECORRENTE';
  institution_id: string;
  category_id: string;
  subcategory_id?: string;
  center_id?: string;
  supplier_id?: string;
  description?: string;  // v4: Opcional
  amount: number;
  // v4: frequency REMOVIDO - usa MONTHLY fixo
  num_installments: number;  // v4: Usa num_installments (igual parcelado)
  start_date: string;
  first_payment_date: string;
  // v4: end_date REMOVIDO
}

export interface RecurringOccurrenceOutput {
  id: string;
  occurrence_number: number;
  event_date: Date;
  effective_date: Date;
  amount: number;
  description: string;
  status: string;
  recurring_group_id: string;
  is_recurring: boolean;
}

export interface RecurringConfigOutput {
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  end_date?: Date;
  total_occurrences?: number;
  generated_occurrences: number;
}

export interface CreateRecurringOutput {
  recurring_group_id: string;
  occurrences: RecurringOccurrenceOutput[];
  recurring_config: RecurringConfigOutput;
}

// Interface para geração automática de recorrências
export interface GenerateNextRecurringInput {
  months_ahead?: number;
  target_date?: string | null;
}

export interface GenerateNextRecurringOutput {
  generated: number;
  details: {
    recurring_group_id: string;
    new_occurrences: number;
  }[];
}

// Interface para deleção de grupos
export interface DeleteGroupMode {
  mode: 'ALL' | 'FUTURE' | 'ONLY_PENDING';
}