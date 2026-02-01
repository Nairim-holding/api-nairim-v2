import { CreateOwnerInput, UpdateOwnerInput } from '@/types/owner';

export class OwnerValidator {
  static validateCreate(data: CreateOwnerInput): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Campos obrigatórios para todos
    if (!data.name?.trim()) {
      errors.push('Nome é obrigatório');
    }

    if (!data.internal_code?.trim()) {
      errors.push('Código interno é obrigatório');
    }

    // Determinar tipo baseado nos campos
    const isPessoaFisica = !!data.cpf;
    const isPessoaJuridica = !!data.cnpj;

    if (!isPessoaFisica && !isPessoaJuridica) {
      errors.push('É necessário informar CPF (Pessoa Física) ou CNPJ (Pessoa Jurídica)');
    }

    // Validações específicas para Pessoa Física
    if (isPessoaFisica) {
      if (!data.occupation?.trim()) {
        errors.push('Profissão é obrigatória para Pessoa Física');
      }
      
      if (!data.marital_status?.trim()) {
        errors.push('Estado civil é obrigatório para Pessoa Física');
      }
      
      if (data.cpf && !this.validateCPF(data.cpf)) {
        errors.push('CPF inválido');
      }

      // Validar que campos de PJ não devem ser preenchidos
      if (data.cnpj) {
        errors.push('Não é permitido informar CNPJ para Pessoa Física');
      }
      if (data.state_registration) {
        errors.push('Inscrição Estadual não é permitida para Pessoa Física');
      }
      if (data.municipal_registration) {
        errors.push('Inscrição Municipal não é permitida para Pessoa Física');
      }
    }

    // Validações específicas para Pessoa Jurídica
    if (isPessoaJuridica) {
      if (data.cnpj && !this.validateCNPJ(data.cnpj)) {
        errors.push('CNPJ inválido');
      }
      
      if (!data.state_registration?.trim()) {
        errors.push('Inscrição Estadual é obrigatória para Pessoa Jurídica');
      }
      
      if (!data.municipal_registration?.trim()) {
        errors.push('Inscrição Municipal é obrigatória para Pessoa Jurídica');
      }

      // Validar que campos de PF não devem ser preenchidos
      if (data.cpf) {
        errors.push('Não é permitido informar CPF para Pessoa Jurídica');
      }
      if (data.occupation) {
        errors.push('Profissão não é permitida para Pessoa Jurídica');
      }
      if (data.marital_status) {
        errors.push('Estado civil não é permitido para Pessoa Jurídica');
      }
    }

    // Validação de contatos
    // if (data.contacts && Array.isArray(data.contacts)) {
    //   data.contacts.forEach((contact: any, index: number) => {
    //     if (contact.email && !this.validateEmail(contact.email)) {
    //       errors.push(`Contato ${index + 1}: Email inválido`);
    //     }
    //     if (!contact.phone?.trim()) {
    //       errors.push(`Contato ${index + 1}: Telefone é obrigatório`);
    //     }
    //   });
    // }

    // Validação de endereços
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

    return { 
      isValid: errors.length === 0, 
      errors 
    };
  }

  static validateUpdate(data: UpdateOwnerInput): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validações de CPF e CNPJ
    if (data.cpf && !this.validateCPF(data.cpf)) {
      errors.push('CPF inválido');
    }

    if (data.cnpj && !this.validateCNPJ(data.cnpj)) {
      errors.push('CNPJ inválido');
    }

    // Validação de email em contatos
    if (data.contacts && Array.isArray(data.contacts)) {
      data.contacts.forEach((contact: any, index: number) => {
        if (contact.email && !this.validateEmail(contact.email)) {
          errors.push(`Contato ${index + 1}: Email inválido`);
        }
      });
    }

    return { 
      isValid: errors.length === 0, 
      errors 
    };
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

    return { 
      isValid: errors.length === 0, 
      errors 
    };
  }

  private static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static validateCPF(cpf: string): boolean {
    // Remove caracteres não numéricos
    const cleanCPF = cpf.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos
    if (cleanCPF.length !== 11) return false;
    
    // Verifica se não é uma sequência de números iguais
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
    
    // Validação dos dígitos verificadores
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
    // Remove caracteres não numéricos
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    // Verifica se tem 14 dígitos
    if (cleanCNPJ.length !== 14) return false;
    
    // Verifica se não é uma sequência de números iguais
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
    
    // Validação dos dígitos verificadores
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