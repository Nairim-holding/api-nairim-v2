import { DocumentType, PropertyStatus } from "@/generated/prisma/enums";

export interface Property {
  id: string;
  owner_id: string;
  agency_id?: string | null;
  type_id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  half_bathrooms: number;
  garage_spaces: number;
  area_total: number;
  area_built: number;
  frontage: number;
  furnished: boolean;
  floor_number: number;
  tax_registration: string;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface PropertyWithRelations extends Property {
  owner: any;
  agency?: any;
  type: any;
  addresses: {
    address: {
      id: string;
      zip_code: string;
      street: string;
      number: string;
      district: string;
      city: string;
      state: string;
      country: string;
      created_at: Date;
      updated_at: Date;
      deleted_at?: Date | null;
    };
  }[];
  documents: Document[];
  values: PropertyValue[];
  leases: any[];
  favorites: any[];
}

export interface PropertyValue {
  id: string;
  property_id: string;
  reference_date: Date;
  purchase_value: number;
  rental_value: number;
  condo_fee: number;
  property_tax: number;
  status: PropertyStatus;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface Document {
  id: string;
  property_id: string;
  created_by: string;
  file_path: string;
  file_type: string;
  description?: string | null;
  type: 'TITLE_DEED' | 'REGISTRATION' | 'PROPERTY_RECORD' | 'IMAGE' | 'OTHER';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreatePropertyInput {
  title: string;
  bedrooms: number;
  bathrooms: number;
  half_bathrooms: number;
  garage_spaces: number;
  area_total: number;
  area_built: number;
  frontage: number;
  furnished: boolean;
  floor_number: number;
  tax_registration: string;
  notes?: string;
  owner_id: string;
  type_id: string;
  agency_id?: string;
  address?: {
    zip_code: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    country?: string;
  };
  values?: {
    purchase_value: number;
    rental_value: number;
    condo_fee: number;
    property_tax: number;
    status: PropertyStatus;
    notes?: string;
    reference_date: Date | string;
  };
}

export interface UpdatePropertyInput extends Partial<CreatePropertyInput> {}

export interface GetPropertiesParams {
  limit?: number;
  page?: number;
  search?: string;
  filters?: Record<string, string>;
  sortOptions?: Record<string, string>;
  includeInactive?: boolean;
}

export interface PaginatedPropertyResponse {
  data: PropertyWithRelations[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface UploadFiles {
  arquivosImagens?: Express.Multer.File[];
  arquivosMatricula?: Express.Multer.File[];
  arquivosRegistro?: Express.Multer.File[];
  arquivosEscritura?: Express.Multer.File[];
}

export interface UploadDocumentInput {
  userId: string;
  arquivosImagens?: Express.Multer.File[];
  arquivosMatricula?: Express.Multer.File[];
  arquivosRegistro?: Express.Multer.File[];
  arquivosEscritura?: Express.Multer.File[];
}

export interface FilterOption {
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  label: string;
  values?: string[];
  options?: string[];
}