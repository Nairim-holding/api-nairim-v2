export class CategoryValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push('Nome da categoria é obrigatório');
    }
    
    if (!data.type || !['INCOME', 'EXPENSE'].includes(data.type)) {
      errors.push('Tipo de categoria inválido. Deve ser INCOME ou EXPENSE');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.name !== undefined && !data.name?.trim()) {
      errors.push('O nome da categoria não pode ser vazio');
    }

    if (data.type !== undefined && !['INCOME', 'EXPENSE'].includes(data.type)) {
      errors.push('Tipo de categoria inválido. Deve ser INCOME ou EXPENSE');
    }

    return { isValid: errors.length === 0, errors };
  }
}