export interface Center {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateCenterInput {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  is_active?: boolean;
}

export interface UpdateCenterInput {
  name?: string;
  type?: 'INCOME' | 'EXPENSE';
  is_active?: boolean;
}

export interface GetCentersParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  filters?: Record<string, any>;
  includeInactive?: boolean;
}