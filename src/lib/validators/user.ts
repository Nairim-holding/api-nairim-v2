import { ValidationUtil } from '../../utils/validation';
import { Gender, Role } from '../../types/user';

/** Campos de telefone: só dígitos, com limite igual ao da coluna. */
const PHONE_RULES: Array<{ field: string; label: string; max: number }> = [
  { field: 'phone_country_code', label: 'DDI', max: 5 },
  { field: 'phone_area_code', label: 'Área', max: 5 },
  { field: 'phone', label: 'Telefone', max: 20 },
  { field: 'phone_extension', label: 'Ramal', max: 10 },
];

/**
 * Valida os campos de perfil adicionados na migração incremental.
 * Todos são opcionais — só valida o que veio preenchido. A janela de
 * horário permitido em si (dias + intervalos) é validada à parte, em
 * `UserAccessScheduleValidator` — aqui só o flag booleano.
 */
function validateProfileFields(data: any): string[] {
  const errors: string[] = [];

  for (const rule of PHONE_RULES) {
    const value = data[rule.field];
    if (value === undefined || value === null || value === '') continue;

    const raw = String(value).trim();
    if (!/^\d+$/.test(raw)) {
      errors.push(`${rule.label} deve conter apenas números`);
    } else if (raw.length > rule.max) {
      errors.push(`${rule.label} deve ter no máximo ${rule.max} dígitos`);
    }
  }

  if (data.is_active !== undefined && typeof data.is_active !== 'boolean') {
    errors.push('Ativo deve ser booleano');
  }

  if (
    data.has_time_restriction !== undefined &&
    typeof data.has_time_restriction !== 'boolean'
  ) {
    errors.push('Horário restrito deve ser booleano');
  }

  return errors;
}

export class UserValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Campos obrigatórios
    if (!data.name?.trim()) errors.push('Nome é obrigatório');
    if (!data.email?.trim()) errors.push('Email é obrigatório');
    if (!data.password?.trim()) errors.push('Senha é obrigatória');
    if (!data.birth_date) errors.push('Data de nascimento é obrigatória');
    if (!data.gender) errors.push('Gênero é obrigatório');

    // Validações específicas
    if (data.email && !ValidationUtil.validateEmail(data.email)) {
      errors.push('Email inválido');
    }

    if (data.password && data.password.length < 6) {
      errors.push('Senha deve ter no mínimo 6 caracteres');
    }

    if (data.birth_date) {
      const birthDate = new Date(data.birth_date);
      const today = new Date();
      if (birthDate >= today) {
        errors.push('Data de nascimento deve ser no passado');
      }
      
      // Verificar se é maior de 16 anos
      const minAgeDate = new Date();
      minAgeDate.setFullYear(minAgeDate.getFullYear() - 16);
      if (birthDate > minAgeDate) {
        errors.push('Usuário deve ter pelo menos 16 anos');
      }
    }

    if (data.gender && !Object.values(Gender).includes(data.gender)) {
      errors.push('Gênero inválido');
    }

    if (data.role && !Object.values(Role).includes(data.role)) {
      errors.push('Função inválida');
    }

    errors.push(...validateProfileFields(data));

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.email && !ValidationUtil.validateEmail(data.email)) {
      errors.push('Email inválido');
    }

    if (data.password && data.password.length < 6) {
      errors.push('Senha deve ter no mínimo 6 caracteres');
    }

    if (data.birth_date) {
      const birthDate = new Date(data.birth_date);
      const today = new Date();
      if (birthDate >= today) {
        errors.push('Data de nascimento deve ser no passado');
      }
      
      const minAgeDate = new Date();
      minAgeDate.setFullYear(minAgeDate.getFullYear() - 16);
      if (birthDate > minAgeDate) {
        errors.push('Usuário deve ter pelo menos 16 anos');
      }
    }

    if (data.gender && !Object.values(Gender).includes(data.gender)) {
      errors.push('Gênero inválido');
    }

    if (data.role && !Object.values(Role).includes(data.role)) {
      errors.push('Função inválida');
    }

    errors.push(...validateProfileFields(data));

    return { isValid: errors.length === 0, errors };
  }

  static validateQueryParams(query: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (query.limit) {
      const limit = parseInt(String(query.limit));
      if (isNaN(limit) || limit < 1 || limit > 100) {
        errors.push('Limit deve ser um número entre 1 e 100');
      }
    }

    if (query.page) {
      const page = parseInt(String(query.page));
      if (isNaN(page) || page < 1) {
        errors.push('Page deve ser um número positivo');
      }
    }

    // Validar parâmetros de enum
    if (query.gender && !Object.values(Gender).includes(query.gender)) {
      errors.push('Gênero inválido');
    }

    if (query.role && !Object.values(Role).includes(query.role)) {
      errors.push('Função inválida');
    }

    return { isValid: errors.length === 0, errors };
  }
}