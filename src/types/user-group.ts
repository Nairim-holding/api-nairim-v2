export interface UserGroupAuthor {
  id: string;
  name: string;
}

export interface UserGroup {
  id: string;
  description: string;
  created_by?: string | null;
  created_at: Date;
  updated_by?: string | null;
  updated_at: Date;
  deleted_at?: Date | null;
  creator?: UserGroupAuthor | null;
  updater?: UserGroupAuthor | null;
}

export interface CreateUserGroupInput {
  description: string;
}

export interface UpdateUserGroupInput {
  description?: string;
}

export interface GetUserGroupsParams {
  limit?: number;
  page?: number;
  search?: string;
  filters?: Record<string, any>;
  sortOptions?: Record<string, string>;
  includeInactive?: boolean;
}

export interface PaginatedUserGroupResponse {
  data: UserGroup[];
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
