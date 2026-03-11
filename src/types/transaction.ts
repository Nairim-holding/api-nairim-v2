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
}

export interface GetTransactionsParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  filters?: Record<string, any>;
  includeInactive?: boolean;
}