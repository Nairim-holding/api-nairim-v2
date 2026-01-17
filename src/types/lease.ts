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

export interface LeaseWithRelations {
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
  property: any;
  owner: any;
  tenant: any;
  type: any;
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
  sortOptions?: {
    sort_id?: string;
    sort_contract_number?: string;
    sort_start_date?: string;
    sort_end_date?: string;
    sort_rent_amount?: string;
    sort_condominium_fee?: string;
    sort_iptu?: string;
    sort_extra_fees?: string;
    sort_commission_value?: string;
    sort_rent_due_day?: string;
    sort_tax_due_day?: string;
    sort_condo_due_day?: string;
    sort_property?: string;
    sort_type?: string;
    sort_owner?: string;
    sort_tenant?: string;
  };
  includeInactive?: boolean;
}

export interface PaginatedLeaseResponse {
  data: Lease[];
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