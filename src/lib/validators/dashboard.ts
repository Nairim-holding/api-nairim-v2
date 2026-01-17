export const validateDashboardParams = (params: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!params.startDate) {
    errors.push('startDate é obrigatório');
  } else if (!isValidDate(params.startDate)) {
    errors.push('startDate deve ser uma data válida no formato YYYY-MM-DD');
  }

  if (!params.endDate) {
    errors.push('endDate é obrigatório');
  } else if (!isValidDate(params.endDate)) {
    errors.push('endDate deve ser uma data válida no formato YYYY-MM-DD');
  }

  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    
    if (start > end) {
      errors.push('startDate não pode ser maior que endDate');
    }
    
    // Verificar se a diferença não é muito grande (opcional)
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      errors.push('O intervalo máximo permitido é de 365 dias');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const isValidDate = (dateString: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};