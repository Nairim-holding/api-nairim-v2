

export interface Owner {
  id: string;
  name: string;
  internal_code: string;
  occupation: string;
  marital_status: string;
  cpf: string | null;
  cnpj: string | null;
  state_registration: string | null;
  municipal_registration: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface OwnerWithRelations extends Owner {
  addresses: Array<{
    address: {
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
      deleted_at: Date | null;
    };
  }>;
  contacts: Array<{
    contact: {
      id: string;
      contact?: string;
      phone?: string;
      email?: string | null;
      cellphone?: string;
      created_at: Date;
      updated_at: Date;
      deleted_at?: Date | null;
    };
  }>;
  properties: Array<{
    id: string;
    title: string;
  }>;
  leases: Array<{
    id: string;
    contract_number: string;
  }>;
}

export interface CreateOwnerInput {
  name: string;
  internal_code: string;
  occupation: string;
  marital_status: string;
  cpf?: string;
  cnpj?: string;
  state_registration?: string;
  municipal_registration?: string;
  contacts?: Array<{
    contact?: string;
    phone?: string;
    email?: string;
    cellphone?: string;
  }>;
  addresses?: Array<{
    zip_code: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    complement?: string;
    country?: string;
  }>;
}

export interface UpdateOwnerInput extends Partial<CreateOwnerInput> {}

export interface GetOwnersParams {
  limit?: number;
  page?: number;
  search?: string;
  filters?: Record<string, any>;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  includeInactive?: boolean;
}

export interface PaginatedOwnerResponse {
  data: OwnerWithRelations[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface FilterOption {
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  label: string;
  description: string;
  values?: string[];
  options?: Array<{ value: any; label: string }>;
  searchable?: boolean;
  autocomplete?: boolean;
  inputType?: string;
  min?: string;
  max?: string;
  dateRange?: boolean;
}

export interface FiltersResponse {
  filters: FilterOption[];
  operators: {
    string: string[];
    number: string[];
    date: string[];
    boolean: string[];
    select: string[];
  };
  defaultSort: string;
  searchFields: string[];
}