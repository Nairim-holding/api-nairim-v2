export interface Card {
  id: string;
  name: string;
  limit?: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateCardInput {
  name: string;
  limit?: number;
  is_active?: boolean;
}

export interface UpdateCardInput {
  name?: string;
  limit?: number;
  is_active?: boolean;
}

export interface GetCardsParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  filters?: Record<string, any>;
  includeInactive?: boolean;
}