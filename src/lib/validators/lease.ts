export class LeaseValidator {
  private static parseDecimal(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const strValue = String(value).trim();
    if (!strValue.includes(',') && strValue.includes('.')) {
      const parsed = parseFloat(strValue);
      if (!isNaN(parsed)) return parsed;
    }
    const cleaned = strValue.replace(/[^\d,-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private static validateIptuConditions(data: any, _errors: string[], warnings: string[]) {
    const baseIptu = this.parseDecimal(data.property_tax);

    if (!baseIptu || baseIptu <= 0) {
      if (data.payment_condition) {
        warnings.push('Para configurar as opções de pagamento, preencha o "Valor do IPTU (Base)" primeiro.');
      }
      return;
    }

    const formattedBase = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(baseIptu);

    if (data.payment_condition === 'IN_FULL_15_DISCOUNT') {
      const cashVal = this.parseDecimal(data.property_tax_cash);
      const minExpectedVal = baseIptu * 0.85;
      const maxExpectedVal = baseIptu;

      if (!cashVal || cashVal <= 0) {
        warnings.push('Por favor, informe o valor da cobrança à vista.');
      } else {
        if (cashVal < (minExpectedVal - 0.10) || cashVal > (maxExpectedVal + 0.10)) {
          const formattedMin = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(minExpectedVal);
          const formattedCurrent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cashVal);
          warnings.push(`O valor à vista informado (${formattedCurrent}) não é válido. O limite permitido é entre ${formattedMin} (aplicando 15% de desconto) e ${formattedBase} (sem desconto).`);
        }
      }
    } else if (data.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
      const firstVal = this.parseDecimal(data.property_tax_first_installment);
      const secondVal = this.parseDecimal(data.property_tax_second_installment);
      const total = firstVal + secondVal;

      const minExpectedTotal = baseIptu * 0.90;
      const maxExpectedTotal = baseIptu;

      if (!firstVal || firstVal <= 0) {
        warnings.push('Por favor, informe o valor da 1ª Parcela.');
      }
      if (!secondVal || secondVal <= 0) {
        warnings.push('Por favor, informe o valor da 2ª Parcela.');
      }

      if (firstVal > 0 && secondVal > 0) {
        if (total < (minExpectedTotal - 0.10) || total > (maxExpectedTotal + 0.10)) {
          const formattedMin = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(minExpectedTotal);
          const formattedCurrent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
          warnings.push(`A soma das duas parcelas (${formattedCurrent}) não é válida. O total deve ficar entre ${formattedMin} (aplicando 10% de desconto) e ${formattedBase} (sem desconto).`);
        }
      }
    } else if (data.payment_condition === 'INSTALLMENTS') {
      if (!data.iptu_installments || !Array.isArray(data.iptu_installments) || data.iptu_installments.length === 0) {
        warnings.push('Por favor, preencha os valores de todas as parcelas no detalhamento.');
        return;
      }

      let totalInstallments = 0;
      for (const val of data.iptu_installments) {
        const numVal = this.parseDecimal(val);
        if (numVal <= 0) {
          warnings.push('Todas as parcelas do IPTU devem ter um valor maior que zero.');
          return;
        }
        totalInstallments += numVal;
      }

      const diff = Math.abs(baseIptu - totalInstallments);

      if (diff > 0.10) {
        const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInstallments);
        let diferencaMsg = '';
        if (totalInstallments > baseIptu) {
          const sobra = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInstallments - baseIptu);
          diferencaMsg = `Passou ${sobra} do valor correto`;
        } else {
          const falta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(baseIptu - totalInstallments);
          diferencaMsg = `Falta ${falta} para fechar o valor correto`;
        }
        warnings.push(`A soma das parcelas informadas (${formattedTotal}) está diferente do valor base do IPTU (${formattedBase}). ${diferencaMsg}. Ajuste as parcelas para bater a conta exata.`);
      }
    }
  }

  static validateCreate(data: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.property_id?.trim()) errors.push('ID da propriedade é obrigatório');
    if (!data.type_id?.trim()) errors.push('Tipo de propriedade é obrigatório');
    if (!data.owner_id?.trim()) errors.push('ID do proprietário é obrigatório');
    if (!data.tenant_id?.trim()) errors.push('ID do inquilino é obrigatório');
    if (!data.contract_number?.trim()) errors.push('Número do contrato é obrigatório');
    if (!data.start_date) errors.push('Data de início é obrigatória');
    if (!data.end_date) errors.push('Data de término é obrigatória');
    if (data.rent_amount === undefined || data.rent_amount === null)
      warnings.push('Valor do aluguel não foi informado');
    if (data.rent_due_day === undefined || data.rent_due_day === null)
      errors.push('Dia de vencimento do aluguel é obrigatório');

    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      if (startDate >= endDate) {
        errors.push('Data de início deve ser anterior à data de término');
      }
    }

    if (data.payment_condition && !['IN_FULL_15_DISCOUNT', 'SECOND_INSTALLMENT_10_DISCOUNT', 'INSTALLMENTS'].includes(data.payment_condition)) {
      errors.push('Condição de pagamento inválida');
    }

    this.validateIptuConditions(data, errors, warnings);

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateUpdate(data: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      if (startDate >= endDate) {
        errors.push('Data de início deve ser anterior à data de término');
      }
    }

    if (data.payment_condition && !['IN_FULL_15_DISCOUNT', 'SECOND_INSTALLMENT_10_DISCOUNT', 'INSTALLMENTS'].includes(data.payment_condition)) {
      errors.push('Condição de pagamento inválida');
    }

    this.validateIptuConditions(data, errors, warnings);

    return { isValid: errors.length === 0, errors, warnings };
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

  private static validateContractNumber(contractNumber: string): boolean {
    return !isNaN(Number(contractNumber));
  }
}