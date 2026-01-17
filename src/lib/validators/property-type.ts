export class PropertyTypeValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.description?.trim()) {
      errors.push('Descrição é obrigatória');
    }

    if (data.description && data.description.length > 100) {
      errors.push('Descrição deve ter no máximo 100 caracteres');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.description !== undefined && !data.description.trim()) {
      errors.push('Descrição não pode ser vazia');
    }

    if (data.description && data.description.length > 100) {
      errors.push('Descrição deve ter no máximo 100 caracteres');
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

    return { isValid: errors.length === 0, errors };
  }
}