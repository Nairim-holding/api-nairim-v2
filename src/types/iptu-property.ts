import { PaymentCondition } from '@/generated/prisma/enums';

export interface PropertyIptu {
  id: string;
  property_id: string;
  year: number;
  property_tax_cash?: number | null;
  property_tax_cash_due_date?: Date | null;
  property_tax_first_installment?: number | null;
  property_tax_first_installment_due_date?: Date | null;
  property_tax_second_installment?: number | null;
  property_tax_second_installment_due_date?: Date | null;
  iptu_installments_count?: number | null;
  iptu_installments?: any | null;
  payment_condition?: PaymentCondition | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface PropertyIptuWithRelations extends PropertyIptu {
  property: {
    id: string;
    title: string;
    owner: { id: string; name: string };
    type: { id: string; description: string };
  };
}

export interface GetIptuPropertiesParams {
  limit?: number;
  page?: number;
  search?: string;
  filters?: Record<string, any>;
  sortOptions?: Record<string, 'asc' | 'desc'>;
  includeInactive?: boolean;
}

export interface IptuPropertyFilterOption {
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  label: string;
  values?: string[];
  options?: Array<{ value: string; label: string }>;
  searchable?: boolean;
  autocomplete?: boolean;
  dateRange?: boolean;
  description?: string;
  min?: string | null;
  max?: string | null;
}
