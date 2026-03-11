export class CardValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []; 

    if (!data.name?.trim()) {
      errors.push('O nome do cartão é obrigatório');
    }
    
    if (data.limit !== undefined && data.limit !== null && isNaN(Number(data.limit))) {
      errors.push('O limite deve ser um valor numérico');
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

    return { isValid: errors.length === 0, errors };
  }
}