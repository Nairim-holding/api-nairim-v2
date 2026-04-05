export class TransactionValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.event_date) errors.push('A Data do Evento é obrigatória');
    if (!data.effective_date) errors.push('A Data de Efetivação é obrigatória');

    if (data.amount === undefined || data.amount === null || isNaN(Number(data.amount))) {
      errors.push('O Valor deve ser numérico e é obrigatório');
    }

    if (!data.category_id?.trim()) errors.push('A Categoria é obrigatória');
    if (!data.financial_institution_id?.trim()) errors.push('A Instituição Financeira é obrigatória');

    if (data.status && !['PENDING', 'COMPLETED'].includes(data.status)) {
      errors.push('Status inválido. Deve ser PENDING ou COMPLETED');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (data.amount !== undefined && isNaN(Number(data.amount))) {
      errors.push('O Valor deve ser numérico');
    }

    if (data.status !== undefined && !['PENDING', 'COMPLETED'].includes(data.status)) {
      errors.push('Status inválido. Deve ser PENDING ou COMPLETED');
    }

    return { isValid: errors.length === 0, errors };
  }
}