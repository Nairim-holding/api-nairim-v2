import { ValidationUtil } from '../../utils/validation';
import { Gender, Role } from '../../types/user';

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