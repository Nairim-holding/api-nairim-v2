export class TenantValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name?.trim()) errors.push('Nome é obrigatório');
    if (!data.internal_code?.trim()) errors.push('Código interno é obrigatório');
    if (!data.occupation?.trim()) errors.push('Ocupação é obrigatória');
    if (!data.marital_status?.trim()) errors.push('Estado civil é obrigatório');

    if (data.cpf && !this.validateCPF(data.cpf)) {
      errors.push('CPF inválido');
    }

    if (data.cnpj && !this.validateCNPJ(data.cnpj)) {
      errors.push('CNPJ inválido');
    }

    if (data.contacts && Array.isArray(data.contacts)) {
      data.contacts.forEach((contact: any, index: number) => {
        if (contact.email && !this.validateEmail(contact.email)) {
          errors.push(`Contato ${index + 1}: Email inválido`);
        }
        if (!contact.phone?.trim()) {
          errors.push(`Contato ${index + 1}: Telefone é obrigatório`);
        }
      });
    }

    if (data.addresses && Array.isArray(data.addresses)) {
      data.addresses.forEach((address: any, index: number) => {
        if (!address.zip_code?.trim()) {
          errors.push(`Endereço ${index + 1}: CEP é obrigatório`);
        }
        if (!address.street?.trim()) {
          errors.push(`Endereço ${index + 1}: Rua é obrigatória`);
        }
        if (!address.number?.trim()) {
          errors.push(`Endereço ${index + 1}: Número é obrigatório`);
        }
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.cpf && !this.validateCPF(data.cpf)) {
      errors.push('CPF inválido');
    }

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

  private static validateCPF(cpf: string): boolean {
    const cleanCPF = cpf.replace(/[^\d]/g, '');
    return cleanCPF.length === 11;
  }

  private static validateCNPJ(cnpj: string): boolean {
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
    return cleanCNPJ.length === 14;
  }
}