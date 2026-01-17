export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateFavoriteInput {
  user_id: string;
  property_id: string;
}

export interface GetFavoritesParams {
  limit?: number;
  page?: number;
  user_id?: string;
  property_id?: string;
  search?: string;
  includeDeleted?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface UserFavorite {
  id: string;
  name: string;
  email: string;
  created_at: Date;
}

export interface PropertyFavorite {
  id: string;
  title: string;
  type?: string;
  status?: string;
}