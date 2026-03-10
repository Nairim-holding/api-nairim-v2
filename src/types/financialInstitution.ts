export interface FinancialInstitution {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateFinancialInstitutionInput {
  name: string;
}

export interface GetFinancialInstitutionsParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: {
    sort_id?: string;
    sort_name?: string;
    sort_created_at?: string;
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