export interface UserColumnPreference {
  id: string;
  user_id: string;
  resource: string;
  column_order: string[];
  column_widths: Record<string, number>;
  created_at: Date;
  updated_at: Date;
}

export interface SaveColumnPreferencesInput {
  resource: string;
  columnOrder: string[];
  columnWidths: Record<string, number>;
}

export interface GetColumnPreferencesParams {
  resource: string;
}

export interface ColumnPreferencesResponse {
  id: string;
  user_id: string;
  resource: string;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface ColumnPreferencesErrorResponse {
  columnOrder: string[];
  columnWidths: Record<string, number>;
}
