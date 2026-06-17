export class PlanningValidator {
  static validateUpsert(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.category_id?.trim()) {
      errors.push('category_id é obrigatório');
    }

    if (!data.type || !['FIXED', 'VARIABLE'].includes(data.type)) {
      errors.push('type deve ser FIXED ou VARIABLE');
    }

    if (data.type === 'FIXED') {
      if (data.default_amount === undefined || data.default_amount === null || data.default_amount === '') {
        errors.push('default_amount é obrigatório para planejamentos do tipo FIXED');
      } else if (isNaN(Number(data.default_amount)) || Number(data.default_amount) < 0) {
        errors.push('default_amount deve ser um número não negativo');
      }
    }

    if (data.type === 'VARIABLE') {
      if (!Array.isArray(data.monthly_values) || data.monthly_values.length === 0) {
        errors.push('monthly_values é obrigatório para planejamentos do tipo VARIABLE e deve ser um array não vazio');
      } else {
        data.monthly_values.forEach((mv: any, index: number) => {
          const month = Number(mv.month);
          if (!mv.month || isNaN(month) || month < 1 || month > 12) {
            errors.push(`monthly_values[${index}].month deve ser um número entre 1 e 12`);
          }
          if (mv.amount === undefined || mv.amount === null || mv.amount === '') {
            errors.push(`monthly_values[${index}].amount é obrigatório`);
          } else if (isNaN(Number(mv.amount)) || Number(mv.amount) < 0) {
            errors.push(`monthly_values[${index}].amount deve ser um número não negativo`);
          }
        });

        const months = data.monthly_values.map((mv: any) => Number(mv.month));
        const uniqueMonths = new Set(months);
        if (uniqueMonths.size !== months.length) {
          errors.push('monthly_values não pode conter meses duplicados');
        }
      }
    }


    return { isValid: errors.length === 0, errors };
  }

  static validateQueryParams(query: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!query.startDate) {
      errors.push('startDate é obrigatório (formato: YYYY-MM-DD)');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(query.startDate)) {
      errors.push('startDate deve estar no formato YYYY-MM-DD');
    } else {
      const d = new Date(query.startDate);
      if (isNaN(d.getTime())) {
        errors.push('startDate é uma data inválida');
      }
    }

    if (!query.endDate) {
      errors.push('endDate é obrigatório (formato: YYYY-MM-DD)');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(query.endDate)) {
      errors.push('endDate deve estar no formato YYYY-MM-DD');
    } else {
      const d = new Date(query.endDate);
      if (isNaN(d.getTime())) {
        errors.push('endDate é uma data inválida');
      }
    }

    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      const end = new Date(query.endDate);
      if (start > end) {
        errors.push('startDate não pode ser maior que endDate');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  static validatePlanningsQuery(_query: any): { isValid: boolean; errors: string[] } {
    return { isValid: true, errors: [] };
  }
}
