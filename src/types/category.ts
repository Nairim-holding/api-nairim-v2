export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  is_active: boolean;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateCategoryInput {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  is_active?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: 'INCOME' | 'EXPENSE';
  is_active?: boolean;
}

export interface GetCategoriesParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  filters?: Record<string, any>;
  includeInactive?: boolean;
}