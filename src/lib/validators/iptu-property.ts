export class IptuPropertyValidator {
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

    if (query.year) {
      const year = parseInt(String(query.year));
      if (isNaN(year) || year < 1900 || year > 2100) {
        errors.push('Ano do IPTU deve ser um número válido entre 1900 e 2100');
      }
    }

    if (query.payment_condition) {
      const validConditions = ['IN_FULL_15_DISCOUNT', 'SECOND_INSTALLMENT_10_DISCOUNT', 'INSTALLMENTS'];
      if (!validConditions.includes(query.payment_condition)) {
        errors.push('Condição de pagamento inválida');
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}
