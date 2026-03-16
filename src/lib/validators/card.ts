export class CardValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []; 

    if (!data.name?.trim()) {
      errors.push('O nome do cartão é obrigatório');
    }
    if (data.limit !== undefined && data.limit !== null && isNaN(Number(data.limit))) {
      errors.push('O limite deve ser um valor numérico');
    }
    if (data.closing_day !== undefined && data.closing_day !== null) {
      const day = Number(data.closing_day);
      if (isNaN(day) || day < 1 || day > 31) errors.push('O dia de fechamento deve ser entre 1 e 31');
    }
    if (data.due_day !== undefined && data.due_day !== null) {
      const day = Number(data.due_day);
      if (isNaN(day) || day < 1 || day > 31) errors.push('O dia de vencimento deve ser entre 1 e 31');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.name !== undefined && !data.name?.trim()) {
      errors.push('O nome do cartão não pode ser vazio');
    }
    if (data.limit !== undefined && data.limit !== null && isNaN(Number(data.limit))) {
      errors.push('O limite deve ser um valor numérico');
    }
    if (data.closing_day !== undefined && data.closing_day !== null) {
      const day = Number(data.closing_day);
      if (isNaN(day) || day < 1 || day > 31) errors.push('O dia de fechamento deve ser entre 1 e 31');
    }
    if (data.due_day !== undefined && data.due_day !== null) {
      const day = Number(data.due_day);
      if (isNaN(day) || day < 1 || day > 31) errors.push('O dia de vencimento deve ser entre 1 e 31');
    }

    return { isValid: errors.length === 0, errors };
  }
}