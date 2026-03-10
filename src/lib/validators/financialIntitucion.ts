export class FinancialInstitutionValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!data.name?.trim()) errors.push('Nome da instituição é obrigatório');
    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (data.name !== undefined && !data.name?.trim()) {
      errors.push('Nome da instituição não pode ser vazio');
    }
    return { isValid: errors.length === 0, errors };
  }

  static validateQueryParams(query: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (query.limit) {
      const limit = parseInt(String(query.limit));
      if (isNaN(limit) || limit < 1 || limit > 100) errors.push('Limit deve ser um número entre 1 e 100');
    }
    if (query.page) {
      const page = parseInt(String(query.page));
      if (isNaN(page) || page < 1) errors.push('Page deve ser um número positivo');
    }
    return { isValid: errors.length === 0, errors };
  }
}