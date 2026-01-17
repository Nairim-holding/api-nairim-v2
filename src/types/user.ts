export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER'
}

export enum Role {
  ADMIN = 'ADMIN',
  DEFAULT = 'DEFAULT'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  birth_date: Date;
  gender: Gender;
  role: Role;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  birth_date: string; // ISO string
  gender: Gender;
  role?: Role;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  birth_date?: string;
  gender?: Gender;
  role?: Role;
}

export interface GetUsersParams {
  limit?: number;
  page?: number;
  search?: string;
  sortOptions?: {
    sort_id?: string;
    sort_name?: string;
    sort_email?: string;
    sort_birth_date?: string;
    sort_gender?: string;
    sort_role?: string;
    sort_created_at?: string;
    sort_updated_at?: string;
  };
  includeInactive?: boolean;
  filters?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface FilterOption {
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  label: string;
  description?: string;
  values?: string[];
  options?: string[];
  searchable?: boolean;
  autocomplete?: boolean;
  inputType?: string;
  mask?: string;
  min?: string;
  max?: string;
  dateRange?: boolean;
}

export interface FiltersResponse {
  filters: FilterOption[];
  operators: {
    string: string[];
    number: string[];
    date: string[];
    boolean: string[];
    enum: string[];
  };
  defaultSort: string;
  searchFields: string[];
}

// Labels para tradução
export const fieldLabels: Record<string, string> = {
  id: 'ID',
  name: 'Nome',
  email: 'E-mail',
  password: 'Senha',
  birth_date: 'Data de Nascimento',
  gender: 'Gênero',
  role: 'Função',
  created_at: 'Criado em',
  updated_at: 'Atualizado em',
  deleted_at: 'Excluído em'
};

export const genderLabels: Record<Gender, string> = {
  [Gender.MALE]: 'Masculino',
  [Gender.FEMALE]: 'Feminino',
  [Gender.OTHER]: 'Outro'
};

export const roleLabels: Record<Role, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.DEFAULT]: 'Usuário Padrão'
};