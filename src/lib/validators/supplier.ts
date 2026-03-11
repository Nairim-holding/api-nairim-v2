export class SupplierValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.legal_name?.trim()) {
      errors.push('A Razão Social é obrigatória');
    }
    
    if (data.cnpj) {
      const cleanCNPJ = data.cnpj.replace(/[^\d]/g, '');
      if (cleanCNPJ.length !== 14) {
        errors.push('CNPJ inválido. Deve conter 14 dígitos.');
      }
    }

    if (data.contacts && Array.isArray(data.contacts)) {
      data.contacts.forEach((contact: any, index: number) => {
        if (!contact.contact?.trim()) {
          errors.push(`Contacto ${index + 1}: O nome do contacto é obrigatório`);
        }
      });
    }

    if (data.addresses && Array.isArray(data.addresses)) {
      data.addresses.forEach((addr: any, index: number) => {
        if (!addr.zip_code?.trim()) errors.push(`Endereço ${index + 1}: O CEP é obrigatório`);
        if (!addr.street?.trim()) errors.push(`Endereço ${index + 1}: A Rua é obrigatória`);
        if (!addr.number?.trim()) errors.push(`Endereço ${index + 1}: O Número é obrigatório`);
        if (!addr.district?.trim()) errors.push(`Endereço ${index + 1}: O Bairro é obrigatório`);
        if (!addr.city?.trim()) errors.push(`Endereço ${index + 1}: A Cidade é obrigatória`);
        if (!addr.state?.trim()) errors.push(`Endereço ${index + 1}: O Estado é obrigatório`);
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    return this.validateCreate(data); // As regras de atualização mantêm a mesma integridade estrutural
  }
}