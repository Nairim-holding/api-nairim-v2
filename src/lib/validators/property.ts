export class PropertyValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.title?.trim()) errors.push('Título é obrigatório');
    if (!data.owner_id?.trim()) errors.push('Proprietário é obrigatório');
    if (!data.type_id?.trim()) errors.push('Tipo de propriedade é obrigatório');
    
    if (data.bedrooms === undefined || data.bedrooms === null || isNaN(data.bedrooms)) 
      errors.push('Número de quartos é obrigatório');
    if (data.bathrooms === undefined || data.bathrooms === null || isNaN(data.bathrooms)) 
      errors.push('Número de banheiros é obrigatório');
    if (data.area_total === undefined || data.area_total === null || isNaN(data.area_total)) 
      errors.push('Área total é obrigatória');
    
    if (!data.tax_registration?.trim()) errors.push('Registro de imposto é obrigatório');

    if (data.address) {
      if (!data.address.zip_code?.trim()) errors.push('CEP é obrigatório');
      if (!data.address.street?.trim()) errors.push('Rua é obrigatória');
      if (!data.address.number?.trim()) errors.push('Número é obrigatório');
      if (!data.address.district?.trim()) errors.push('Bairro é obrigatório');
      if (!data.address.city?.trim()) errors.push('Cidade é obrigatória');
      if (!data.address.state?.trim()) errors.push('Estado é obrigatório');
    }

    if (data.values) {
      if (data.values.purchase_value === undefined || isNaN(data.values.purchase_value))
        errors.push('Valor de compra é obrigatório');
      if (data.values.rental_value === undefined || isNaN(data.values.rental_value))
        errors.push('Valor de aluguel é obrigatório');
      if (!data.values.status) errors.push('Status da propriedade é obrigatório');
      if (!data.values.reference_date) errors.push('Data de referência é obrigatória');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.bedrooms !== undefined && isNaN(data.bedrooms)) 
      errors.push('Número de quartos deve ser um número');
    if (data.bathrooms !== undefined && isNaN(data.bathrooms)) 
      errors.push('Número de banheiros deve ser um número');
    if (data.area_total !== undefined && isNaN(data.area_total)) 
      errors.push('Área total deve ser um número');

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
}