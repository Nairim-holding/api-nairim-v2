export class TransactionValidator {
  static validateCreate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.event_date) errors.push('A Data do Evento é obrigatória');
    if (!data.effective_date) errors.push('A Data de Efetivação é obrigatória');

    if (data.amount === undefined || data.amount === null || isNaN(Number(data.amount))) {
      errors.push('O Valor deve ser numérico e é obrigatório');
    }

    if (!data.category_id?.trim()) errors.push('A Categoria é obrigatória');
    if (!data.financial_institution_id?.trim()) errors.push('A Instituição Financeira é obrigatória');

    if (data.status && !['PENDING', 'COMPLETED'].includes(data.status)) {
      errors.push('Status inválido. Deve ser PENDING ou COMPLETED');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (data.amount !== undefined && isNaN(Number(data.amount))) {
      errors.push('O Valor deve ser numérico');
    }

    if (data.status !== undefined && !['PENDING', 'COMPLETED'].includes(data.status)) {
      errors.push('Status inválido. Deve ser PENDING ou COMPLETED');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateInstallments(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.institution_id?.trim()) errors.push('A Instituição Financeira é obrigatória');
    if (!data.category_id?.trim()) errors.push('A Categoria é obrigatória');
    // Descrição é opcional - se não fornecida, será usado "Parcela X/Y"

    // v2: Validar installment_amount (valor de cada parcela)
    const installmentAmount = this.parseAmount(data.installment_amount);
    if (installmentAmount === null || isNaN(installmentAmount)) {
      errors.push('O Valor da Parcela deve ser numérico e é obrigatório');
    } else if (installmentAmount <= 0) {
      errors.push('O Valor da Parcela deve ser maior que zero');
    }

    if (data.num_installments === undefined || data.num_installments === null || isNaN(Number(data.num_installments))) {
      errors.push('O Número de Parcelas é obrigatório');
    } else {
      const num = Number(data.num_installments);
      if (num < 2 || num > 120) {
        errors.push('O Número de Parcelas deve estar entre 2 e 120');
      }
    }

    // v2: Validar que total_amount bate com cálculo (installment_amount × num_installments)
    const totalAmount = this.parseAmount(data.total_amount);
    if (totalAmount === null || isNaN(totalAmount)) {
      errors.push('O Valor Total deve ser numérico e é obrigatório');
    } else {
      const numInstallments = Number(data.num_installments || 0);
      const expectedTotal = installmentAmount !== null ? installmentAmount * numInstallments : 0;
      // Tolerância de 0.01 para arredondamento
      if (expectedTotal > 0 && Math.abs(totalAmount - expectedTotal) > 0.01) {
        errors.push(`Total inválido: esperado ${expectedTotal.toFixed(2)}, recebido ${totalAmount.toFixed(2)}`);
      }
    }

    if (!data.start_date) errors.push('A Data de Início é obrigatória');
    if (!data.first_payment_date) errors.push('A Data do Primeiro Pagamento é obrigatória');

    const firstPayment = new Date(data.first_payment_date);
    const startDate = new Date(data.start_date);
    if (!isNaN(firstPayment.getTime()) && !isNaN(startDate.getTime())) {
      if (firstPayment < startDate) {
        errors.push('A Data do Primeiro Pagamento deve ser igual ou posterior à Data de Início');
      }
    }

    // v4: Parcelado aceita EXPENSE e INCOME
    if (data.transaction_type && !['EXPENSE', 'INCOME'].includes(data.transaction_type)) {
      errors.push('Parcelado deve ser do tipo EXPENSE ou INCOME');
    }

    return { isValid: errors.length === 0, errors };
  }

  // Helper para converter valor (número ou string formatada)
  private static parseAmount(value: any): number | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove símbolo de moeda e espaços, troca vírgula por ponto
      const clean = value.replace(/[R$\s]/g, '').replace(',', '.');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  static validateRecurring(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.institution_id?.trim()) errors.push('A Instituição Financeira é obrigatória');
    if (!data.category_id?.trim()) errors.push('A Categoria é obrigatória');
    // Descrição é opcional - se não fornecida, será usado "Lançamento X/Y"

    // v4: Usar num_installments para quantidade (igual ao parcelado)
    if (data.num_installments === undefined || data.num_installments === null || isNaN(Number(data.num_installments))) {
      errors.push('O Número de Lançamentos é obrigatório');
    } else {
      const num = Number(data.num_installments);
      if (num < 2 || num > 120) {
        errors.push('O Número de Lançamentos deve estar entre 2 e 120');
      }
    }

    if (data.amount === undefined || data.amount === null || isNaN(Number(data.amount))) {
      errors.push('O Valor deve ser numérico e é obrigatório');
    } else if (Number(data.amount) <= 0) {
      errors.push('O Valor deve ser maior que zero');
    }

    // v4: frequency REMOVIDO - não é mais enviado pelo front (usamos MONTHLY fixo)

    if (!data.start_date) errors.push('A Data de Início é obrigatória');
    if (!data.first_payment_date) errors.push('A Data do Primeiro Pagamento é obrigatória');

    const firstPayment = new Date(data.first_payment_date);
    const startDate = new Date(data.start_date);
    if (!isNaN(firstPayment.getTime()) && !isNaN(startDate.getTime())) {
      if (firstPayment < startDate) {
        errors.push('A Data do Primeiro Pagamento deve ser igual ou posterior à Data de Início');
      }
    }

    // v4: Apenas EXPENSE permitido
    if (data.transaction_type && data.transaction_type !== 'EXPENSE') {
      errors.push('Recorrente só é permitido para Despesas (EXPENSE)');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateGenerateNext(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.months_ahead !== undefined && (isNaN(Number(data.months_ahead)) || Number(data.months_ahead) < 1)) {
      errors.push('O valor de months_ahead deve ser um número maior que zero');
    }

    if (data.target_date && isNaN(new Date(data.target_date).getTime())) {
      errors.push('A target_date deve ser uma data válida');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateDeleteGroup(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.mode) {
      errors.push('O modo de deleção é obrigatório');
    } else if (!['ALL', 'FUTURE', 'ONLY_PENDING'].includes(data.mode)) {
      errors.push('O modo deve ser ALL, FUTURE ou ONLY_PENDING');
    }

    return { isValid: errors.length === 0, errors };
  }
}