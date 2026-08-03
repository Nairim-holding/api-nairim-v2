export interface GetAuditLogsParams {
  limit?: number;
  page?: number;
  search?: string;
  filters?: Record<string, any>;
  sortOptions?: Record<string, string>;
}

export interface AuditLogRow {
  id: string;
  company: { id: string; name: string } | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  action_label: string;
  table_name: string;
  table_label: string;
  record_id: string | null;
  ip: string | null;
  created_at: Date;
}

export interface ChangedField {
  field: string;
  label: string;
  old_value: unknown;
  new_value: unknown;
}

export interface AuditLogDetail extends AuditLogRow {
  /** Vazio para LOGIN/LOGIN_FAILED (sem registro de negócio envolvido). */
  changed_fields: ChangedField[];
}

export interface PaginatedAuditLogResponse {
  data: AuditLogRow[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface FilterOption {
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  label: string;
  description?: string;
  values?: any[];
  options?: any[];
  searchable?: boolean;
  autocomplete?: boolean;
  dateRange?: boolean;
  min?: string;
  max?: string;
}

export interface FiltersResponse {
  filters: FilterOption[];
}
