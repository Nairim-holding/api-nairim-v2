export class TenantValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name?.trim()) errors.push('Nome é obrigatório');
    if (!data.internal_code?.trim()) errors.push('Código interno é obrigatório');

    const isPessoaFisica = !!data.cpf;
    const isPessoaJuridica = !!data.cnpj;

    if (!isPessoaFisica && !isPessoaJuridica) {
      errors.push('É necessário informar CPF (Pessoa Física) ou CNPJ (Pessoa Jurídica)');
    }

    if (isPessoaFisica) {
      if (!data.occupation?.trim()) errors.push('Profissão é obrigatória');
      if (!data.marital_status?.trim()) errors.push('Estado civil é obrigatório');
      if (data.cpf && !this.validateCPF(data.cpf)) errors.push('CPF inválido');
    }

    if (isPessoaJuridica) {
      if (data.cnpj && !this.validateCNPJ(data.cnpj)) errors.push('CNPJ inválido');
      if (!data.state_registration?.trim()) errors.push('Inscrição Estadual é obrigatória');
      if (!data.municipal_registration?.trim()) errors.push('Inscrição Municipal é obrigatória');
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

    if (data.name !== undefined && !data.name?.trim()) {
      errors.push('Nome é obrigatório');
    }

    if (data.internal_code !== undefined && !data.internal_code?.trim()) {
      errors.push('Código interno é obrigatório');
    }

    const isPessoaFisica = data.cnpj === null && data.state_registration === null;
    const isPessoaJuridica = data.cpf === null && data.marital_status === null;

    if (isPessoaFisica) {
      if (!data.cpf || data.cpf.trim() === '') {
        errors.push('CPF é obrigatório para Pessoa Física');
      } else if (!this.validateCPF(data.cpf)) {
        errors.push('CPF inválido');
      }

      if (!data.occupation || data.occupation.trim() === '') {
        errors.push('Profissão é obrigatória para Pessoa Física');
      }

      if (!data.marital_status || data.marital_status.trim() === '') {
        errors.push('Estado civil é obrigatório para Pessoa Física');
      }
    } else if (isPessoaJuridica) {
      if (!data.cnpj || data.cnpj.trim() === '') {
        errors.push('CNPJ é obrigatório para Pessoa Jurídica');
      } else if (!this.validateCNPJ(data.cnpj)) {
        errors.push('CNPJ inválido');
      }

      if (!data.state_registration || data.state_registration.trim() === '') {
        errors.push('Inscrição Estadual é obrigatória para Pessoa Jurídica');
      }

      if (!data.municipal_registration || data.municipal_registration.trim() === '') {
        errors.push('Inscrição Municipal é obrigatória para Pessoa Jurídica');
      }
    } else {
      if (data.cpf && !this.validateCPF(data.cpf)) {
        errors.push('CPF inválido');
      }
      if (data.cnpj && !this.validateCNPJ(data.cnpj)) {
        errors.push('CNPJ inválido');
      }
    }

    if (data.contacts && Array.isArray(data.contacts)) {
      data.contacts.forEach((contact: any, index: number) => {
        if (contact.email && !this.validateEmail(contact.email)) {
          errors.push(`Contato ${index + 1}: Email inválido`);
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
    const cleanCPF = cpf.replace(/\D/g, '');
    
    if (cleanCPF.length !== 11) return false;
    
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;
    
    return true;
  }

  private static validateCNPJ(cnpj: string): boolean {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    if (cleanCNPJ.length !== 14) return false;
    
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
    
    let size = cleanCNPJ.length - 2;
    let numbers = cleanCNPJ.substring(0, size);
    const digits = cleanCNPJ.substring(size);
    let sum = 0;
    let pos = size - 7;
    
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;
    
    size = size + 1;
    numbers = cleanCNPJ.substring(0, size);
    sum = 0;
    pos = size - 7;
    
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;
    
    return true;
  }
}