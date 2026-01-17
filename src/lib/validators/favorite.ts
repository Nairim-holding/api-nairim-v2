export class FavoriteValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.user_id) {
      errors.push('user_id é obrigatório');
    } else if (typeof data.user_id !== 'string') {
      errors.push('user_id deve ser uma string');
    }

    if (!data.property_id) {
      errors.push('property_id é obrigatório');
    } else if (typeof data.property_id !== 'string') {
      errors.push('property_id deve ser uma string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateQueryParams(params: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validações opcionais
    if (params.limit && (isNaN(Number(params.limit)) || Number(params.limit) < 1)) {
      errors.push('limit deve ser um número positivo');
    }

    if (params.page && (isNaN(Number(params.page)) || Number(params.page) < 1)) {
      errors.push('page deve ser um número positivo');
    }

    if (params.user_id && typeof params.user_id !== 'string') {
      errors.push('user_id deve ser uma string');
    }

    if (params.property_id && typeof params.property_id !== 'string') {
      errors.push('property_id deve ser uma string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}