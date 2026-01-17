export class AgencyValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.trade_name?.trim()) errors.push('Nome fantasia é obrigatório');
    if (!data.legal_name?.trim()) errors.push('Razão social é obrigatória');
    if (!data.cnpj?.trim()) errors.push('CNPJ é obrigatório');

    if (data.cnpj && !this.validateCNPJ(data.cnpj)) {
      errors.push('CNPJ inválido');
    }

    if (data.contacts && Array.isArray(data.contacts)) {
      data.contacts.forEach((contact: any, index: number) => {
        if (contact.email && !this.validateEmail(contact.email)) {
          errors.push(`Contato ${index + 1}: Email inválido`);
        }
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.cnpj && !this.validateCNPJ(data.cnpj)) {
      errors.push('CNPJ inválido');
    }

    if (data.contacts && Array.isArray(data.contacts)) {
      data.contacts.forEach((contact: any, index: number) => {
        if (contact.email && !this.validateEmail(contact.email)) {
          errors.push(`Contato ${index + 1}: Email inválido`);
        }
      });
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

  private static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static validateCNPJ(cnpj: string): boolean {
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
    return cleanCNPJ.length === 14;
  }
}