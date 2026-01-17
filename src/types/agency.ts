export interface Agency {
  id: string;
  trade_name: string;
  legal_name: string;
  cnpj: string;
  state_registration?: string | null;
  municipal_registration?: string | null;
  license_number?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAgencyInput {
  trade_name: string;
  legal_name: string;
  cnpj: string;
  state_registration?: string;
  municipal_registration?: string;
  license_number?: string;
  contacts?: {
    contact: string;
    phone: string;
    email?: string;
    whatsapp?: boolean;
  }[];
  addresses?: {
    zip_code: string;
    street: string;
    number: number;
    district: string;
    city: string;
    state: string;
    country: string;
  }[];
}

export interface GetAgenciesParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: {
    sort_id?: string;
    sort_trade_name?: string;
    sort_legal_name?: string;
    sort_cnpj?: string;
    sort_state_registration?: string;
    sort_municipal_registration?: string;
    sort_license_number?: string;
  };
  includeInactive?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface FilterOption {
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  label: string;
  values?: string[];
}

export interface FiltersResponse {
  filters: FilterOption[];
}