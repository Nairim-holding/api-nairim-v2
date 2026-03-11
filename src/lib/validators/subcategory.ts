export class SubcategoryValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push('Nome da subcategoria é obrigatório');
    }
    if (!data.category_id?.trim()) {
      errors.push('O ID da categoria pai é obrigatório');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.name !== undefined && !data.name?.trim()) {
      errors.push('O nome da subcategoria não pode ser vazio');
    }
    if (data.category_id !== undefined && !data.category_id?.trim()) {
      errors.push('O ID da categoria pai não pode ser vazio');
    }

    return { isValid: errors.length === 0, errors };
  }
}