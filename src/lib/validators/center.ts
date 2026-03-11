export class CenterValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push('Nome do centro é obrigatório');
    }
    if (!data.type || !['INCOME', 'EXPENSE'].includes(data.type)) {
      errors.push('Tipo de centro inválido. Deve ser INCOME (Receita) ou EXPENSE (Despesa)');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.name !== undefined && !data.name?.trim()) {
      errors.push('O nome do centro não pode ser vazio');
    }
    if (data.type !== undefined && !['INCOME', 'EXPENSE'].includes(data.type)) {
      errors.push('Tipo de centro inválido. Deve ser INCOME (Receita) ou EXPENSE (Despesa)');
    }

    return { isValid: errors.length === 0, errors };
  }
}