export interface Supplier {
  id: string;
  sequential_id: number;
  legal_name: string;
  trade_name?: string | null;
  cnpj?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateSupplierInput {
  legal_name: string;
  trade_name?: string;
  cnpj?: string;
  state_registration?: string;
  municipal_registration?: string;
  contacts?: {
    contact: string;
    phone?: string;
    cellphone?: string;
    email?: string;
  }[];
  addresses?: {
    zip_code: string;
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
    country: string;
  }[];
}

export interface GetSuppliersParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  filters?: Record<string, any>;
  includeInactive?: boolean;
}