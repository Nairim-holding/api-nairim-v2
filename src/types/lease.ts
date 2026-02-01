export interface Lease {
  id: string;
  contract_number: string;
  start_date: Date;
  end_date: Date;
  rent_amount: number;
  condo_fee?: number | null;
  property_tax?: number | null;
  extra_charges?: number | null;
  commission_amount?: number | null;
  rent_due_day: number;
  tax_due_day?: number | null;
  condo_due_day?: number | null;
  property_id: string;
  type_id: string;
  owner_id: string;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface LeaseWithRelations extends Lease {
  property: {
    id: string;
    title: string;
    type: {
      id: string;
      description: string;
    };
  };
  owner: {
    id: string;
    name: string;
  };
  tenant: {
    id: string;
    name: string;
  };
}

export interface CreateLeaseInput {
  property_id: string;
  type_id: string;
  owner_id: string;
  tenant_id: string;
  contract_number: string;
  start_date: Date | string;
  end_date: Date | string;
  rent_amount: number;
  condo_fee?: number;
  property_tax?: number;
  extra_charges?: number;
  commission_amount?: number;
  rent_due_day: number;
  tax_due_day?: number;
  condo_due_day?: number;
}

export interface UpdateLeaseInput extends Partial<CreateLeaseInput> {}

export interface GetLeasesParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  includeInactive?: boolean;
  filters?: Record<string, any>;
}

export interface PaginatedLeaseResponse {
  data: LeaseWithRelations[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface FilterOption {
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  label: string;
  values?: string[];
  options?: Array<{ value: string; label: string }>;
  searchable?: boolean;
  autocomplete?: boolean;
  dateRange?: boolean;
  description?: string;
}

export interface FiltersResponse {
  filters: FilterOption[];
  operators: Record<string, string[]>;
  defaultSort: string;
  searchFields: string[];
}