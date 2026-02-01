export interface Tenant {
  id: string;
  name: string;
  internal_code: string;
  occupation: string;
  marital_status: string;
  cpf?: string | null;
  cnpj?: string | null;
  state_registration?: string | null;     
  municipal_registration?: string | null; 
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface Address {
  id: string;
  zip_code: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  country: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface Contact {
  id: string;
  contact?: string;
  phone?: string;
  email?: string | null;
  cellphone?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface TenantWithRelations extends Tenant {
  leases: any[];
  addresses: {
    address: Address;
  }[];
  contacts: {
    contact: Contact;
  }[];
}

export interface CreateTenantInput {
  name: string;
  internal_code: string;
  occupation: string;
  marital_status: string;
  cpf?: string;
  cnpj?: string;
  state_registration?: string | null;     
  municipal_registration?: string | null;
  contacts?: {
    contact: string;
    phone: string;
    email?: string;
    whatsapp?: boolean;
  }[];
  addresses?: {
    zip_code: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    country?: string;
  }[];
}

export interface UpdateTenantInput extends Partial<CreateTenantInput> {}

export interface GetTenantsParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  includeInactive?: boolean;
  filters?: Record<string, any>;
}

export interface PaginatedTenantResponse {
  data: TenantWithRelations[];
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