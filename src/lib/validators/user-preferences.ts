export class UserPreferencesValidator {
  static validateSaveColumnPreferences(data: any): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    // Validar resource
    if (!data.resource) {
      errors.resource = 'Campo obrigatório';
    } else if (typeof data.resource !== 'string') {
      errors.resource = 'Deve ser uma string';
    } else if (data.resource.length < 3 || data.resource.length > 100) {
      errors.resource = 'Deve conter entre 3 e 100 caracteres';
    } else if (!/^[a-zA-Z0-9-]+$/.test(data.resource)) {
      errors.resource = 'Deve conter apenas letras, números e hífens';
    }

    // Validar columnOrder
    if (!data.columnOrder) {
      errors.columnOrder = 'Deve ser um array não vazio';
    } else if (!Array.isArray(data.columnOrder)) {
      errors.columnOrder = 'Deve ser um array';
    } else if (data.columnOrder.length === 0) {
      errors.columnOrder = 'Deve ser um array não vazio';
    } else {
      const hasNonString = data.columnOrder.some((col: any) => typeof col !== 'string');
      if (hasNonString) {
        errors.columnOrder = 'Todos os elementos devem ser strings';
      }

      const uniqueColumns = new Set(data.columnOrder);
      if (uniqueColumns.size !== data.columnOrder.length) {
        errors.columnOrder = 'Colunas devem ser únicas';
      }
    }

    // Validar columnWidths
    if (!data.columnWidths) {
      errors.columnWidths = 'Valores devem ser números positivos';
    } else if (typeof data.columnWidths !== 'object' || Array.isArray(data.columnWidths)) {
      errors.columnWidths = 'Deve ser um objeto';
    } else {
      const hasInvalidValues = Object.values(data.columnWidths).some(
        (value: any) => typeof value !== 'number' || value <= 0
      );
      if (hasInvalidValues) {
        errors.columnWidths = 'Valores devem ser números positivos';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  static validateGetColumnPreferences(params: any): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    if (!params.resource) {
      errors.resource = 'Campo obrigatório';
    } else if (typeof params.resource !== 'string') {
      errors.resource = 'Deve ser uma string';
    } else if (params.resource.length < 3 || params.resource.length > 100) {
      errors.resource = 'Deve conter entre 3 e 100 caracteres';
    } else if (!/^[a-zA-Z0-9-]+$/.test(params.resource)) {
      errors.resource = 'Deve conter apenas letras, números e hífens';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  static validateResource(resource: any): string | null {
    if (!resource) {
      return 'Campo obrigatório';
    } else if (typeof resource !== 'string') {
      return 'Deve ser uma string';
    } else if (resource.length < 3 || resource.length > 100) {
      return 'Deve conter entre 3 e 100 caracteres';
    } else if (!/^[a-zA-Z0-9-]+$/.test(resource)) {
      return 'Deve conter apenas letras, números e hífens';
    }
    return null;
  }

  static validateGetDashboardLayout(params: any): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    const resourceError = this.validateResource(params.resource);
    if (resourceError) errors.resource = resourceError;

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  static validateSaveDashboardLayout(data: any): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    const resourceError = this.validateResource(data.resource);
    if (resourceError) errors.resource = resourceError;

    if (!Array.isArray(data.layout)) {
      errors.layout = 'Deve ser um array';
    } else {
      const isValidItem = (item: any) =>
        item && typeof item === 'object' &&
        typeof item.i === 'string' && item.i.length > 0 &&
        Number.isFinite(item.x) && Number.isFinite(item.y) &&
        Number.isFinite(item.w) && Number.isFinite(item.h) &&
        item.w > 0 && item.h > 0;

      if (!data.layout.every(isValidItem)) {
        errors.layout = 'Cada item deve conter i, x, y, w, h válidos';
      } else {
        const ids = data.layout.map((item: any) => item.i);
        if (new Set(ids).size !== ids.length) {
          errors.layout = 'Os ids dos cards (i) devem ser únicos';
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
}
