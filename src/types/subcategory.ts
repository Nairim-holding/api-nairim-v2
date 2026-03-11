export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateSubcategoryInput {
  category_id: string;
  name: string;
  is_active?: boolean;
}

export interface UpdateSubcategoryInput {
  category_id?: string;
  name?: string;
  is_active?: boolean;
}

export interface GetSubcategoriesParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  filters?: Record<string, any>;
  includeInactive?: boolean;
}