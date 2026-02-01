export class LeaseValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.property_id?.trim()) errors.push('ID da propriedade é obrigatório');
    if (!data.type_id?.trim()) errors.push('Tipo de propriedade é obrigatório');
    if (!data.owner_id?.trim()) errors.push('ID do proprietário é obrigatório');
    if (!data.tenant_id?.trim()) errors.push('ID do inquilino é obrigatório');
    if (!data.contract_number?.trim()) errors.push('Número do contrato é obrigatório');
    if (!data.start_date) errors.push('Data de início é obrigatória');
    if (!data.end_date) errors.push('Data de término é obrigatória');
    if (data.rent_amount === undefined || data.rent_amount === null) 
      errors.push('Valor do aluguel é obrigatório');
    if (data.rent_due_day === undefined || data.rent_due_day === null)
      errors.push('Dia de vencimento do aluguel é obrigatório');
    
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      if (startDate >= endDate) {
        errors.push('Data de início deve ser anterior à data de término');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      if (startDate >= endDate) {
        errors.push('Data de início deve ser anterior à data de término');
      }
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

  private static validateContractNumber(contractNumber: string): boolean {
    return !isNaN(Number(contractNumber));
  }
}