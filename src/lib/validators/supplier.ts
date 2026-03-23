export class SupplierValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Apenas a Razão Social / Nome Completo é obrigatório agora
    if (!data.legal_name?.trim()) {
      errors.push('O Nome / Razão Social é obrigatório');
    }
    
    if (data.cnpj) {
      const cleanCNPJ = data.cnpj.replace(/[^\d]/g, '');
      if (cleanCNPJ.length !== 14) {
        errors.push('CNPJ inválido. Deve conter 14 dígitos.');
      }
    }

    if (data.cpf) { 
      const cleanCPF = data.cpf.replace(/[^\d]/g, '');
      if (cleanCPF.length !== 11) {
        errors.push('CPF inválido. Deve conter 11 dígitos.');
      }
    }

    // Removida a validação que obrigava o preenchimento de endereços e contatos.
    // Se eles forem enviados parcialmente preenchidos, o banco aceitará normalmente.

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    return this.validateCreate(data); 
  }
}