export interface PropertyType {
  id: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreatePropertyTypeInput {
  description: string;
}

export interface UpdatePropertyTypeInput {
  description?: string;
}

export interface GetPropertyTypesParams {
  limit?: number;
  page?: number;
  search?: string;
  filters?: Record<string, any>;
  sortOptions?: Record<string, string>;
  includeInactive?: boolean;
}

export interface PaginatedPropertyTypeResponse {
  data: PropertyType[];
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