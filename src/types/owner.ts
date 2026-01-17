export interface Owner {
  id: string;
  name: string;
  internal_code: string;
  occupation: string;
  marital_status: string;
  cpf?: string | null;
  cnpj?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface OwnerWithRelations extends Owner {
  properties: any[];
  leases: any[];
  addresses: {
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
      deleted_at?: Date | null;
    };
  }[];
  contacts: {
    contact: {
      id: string;
      contact: string;
      phone: string;
      email?: string | null;
      whatsapp: boolean;
      created_at: Date;
      updated_at: Date;
      deleted_at?: Date | null;
    };
  }[];
}

export interface CreateOwnerInput {
  name: string;
  internal_code: string;
  occupation: string;
  marital_status: string;
  cpf?: string;
  cnpj?: string;
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

export interface UpdateOwnerInput extends Partial<CreateOwnerInput> {}

export interface GetOwnersParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: {
    sort_id?: string;
    sort_name?: string;
    sort_internal_code?: string;
    sort_occupation?: string;
    sort_marital_status?: string;
    sort_cnpj?: string;
    sort_cpf?: string;
  };
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
  type: 'string' | 'number' | 'date' | 'boolean';
  label: string;
  values?: string[];
}

export interface FiltersResponse {
  filters: FilterOption[];
}