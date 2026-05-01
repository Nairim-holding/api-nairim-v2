import prisma from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

export class IptuPropertyService {
  static async getIptuPropertyFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (key === 'year') {
              where.year = parseInt(String(value));
            } else if (key === 'payment_condition') {
              where.payment_condition = value;
            } else if (key === 'property_tax_cash') {
              where.property_tax_cash = parseFloat(String(value));
            } else if (key === 'property_tax_first_installment') {
              where.property_tax_first_installment = parseFloat(String(value));
            } else if (key === 'property_tax_second_installment') {
              where.property_tax_second_installment = parseFloat(String(value));
            } else if (key === 'iptu_installments_count') {
              where.iptu_installments_count = parseInt(String(value));
            }
          }
        });
      }

      const [iptus, dateRange] = await Promise.all([
        prisma.propertyIptu.findMany({
          where,
          select: {
            year: true,
            property_tax_cash: true,
            property_tax_first_installment: true,
            property_tax_second_installment: true,
            payment_condition: true,
            iptu_installments_count: true,
            property_tax_cash_due_date: true,
            property_tax_first_installment_due_date: true,
            property_tax_second_installment_due_date: true,
          },
        }),
        prisma.propertyIptu.aggregate({
          where,
          _min: { created_at: true, year: true },
          _max: { created_at: true, year: true },
        }),
      ]);

      const uniqueYears = [...new Set(iptus.filter(i => i.year).map(i => i.year.toString()))]
        .sort((a, b) => parseInt(a) - parseInt(b));
      const uniqueCashValues = [...new Set(iptus.filter(i => i.property_tax_cash).map(i => i.property_tax_cash!.toString()))]
        .sort((a, b) => parseFloat(a) - parseFloat(b));
      const uniqueFirstInstallments = [...new Set(iptus.filter(i => i.property_tax_first_installment).map(i => i.property_tax_first_installment!.toString()))]
        .sort((a, b) => parseFloat(a) - parseFloat(b));
      const uniqueSecondInstallments = [...new Set(iptus.filter(i => i.property_tax_second_installment).map(i => i.property_tax_second_installment!.toString()))]
        .sort((a, b) => parseFloat(a) - parseFloat(b));
      const uniqueInstallmentsCounts = [...new Set(iptus.filter(i => i.iptu_installments_count !== null).map(i => i.iptu_installments_count!.toString()))]
        .sort((a, b) => parseInt(a) - parseInt(b));

      const filtersList = [
        {
          field: 'year',
          type: 'number',
          label: 'Ano do IPTU',
          description: 'Ano de exercício do IPTU',
          values: uniqueYears,
          searchable: true,
        },
        {
          field: 'payment_condition',
          type: 'select',
          label: 'Condição de Pagamento',
          description: 'Condição de pagamento do IPTU',
          options: [
            { value: 'IN_FULL_15_DISCOUNT', label: 'Cota Única (15% desconto)' },
            { value: 'SECOND_INSTALLMENT_10_DISCOUNT', label: '2ª Cota (10% desconto)' },
            { value: 'INSTALLMENTS', label: 'Parcelado' },
          ],
          searchable: false,
        },
        {
          field: 'property_tax_cash',
          type: 'number',
          label: 'Cota Única (15% desconto)',
          description: 'Valor da cota única com 15% de desconto',
          values: uniqueCashValues,
          searchable: true,
        },
        {
          field: 'property_tax_cash_due_date',
          type: 'date',
          label: 'Vencimento Cota Única',
          description: 'Data de vencimento da cota única',
          dateRange: true,
        },
        {
          field: 'property_tax_first_installment',
          type: 'number',
          label: '1ª Parcela',
          description: 'Valor da primeira parcela',
          values: uniqueFirstInstallments,
          searchable: true,
        },
        {
          field: 'property_tax_first_installment_due_date',
          type: 'date',
          label: 'Vencimento 1ª Parcela',
          description: 'Data de vencimento da primeira parcela',
          dateRange: true,
        },
        {
          field: 'property_tax_second_installment',
          type: 'number',
          label: '2ª Cota (10% desconto)',
          description: 'Valor da segunda cota com 10% de desconto',
          values: uniqueSecondInstallments,
          searchable: true,
        },
        {
          field: 'property_tax_second_installment_due_date',
          type: 'date',
          label: 'Vencimento 2ª Cota',
          description: 'Data de vencimento da segunda cota',
          dateRange: true,
        },
        {
          field: 'iptu_installments_count',
          type: 'number',
          label: 'Quantidade de Parcelas',
          description: 'Número de parcelas do IPTU',
          values: uniqueInstallmentsCounts,
          searchable: true,
        },
        {
          field: 'created_at',
          type: 'date',
          label: 'Criado em',
          description: 'Data de criação do registro',
          min: dateRange._min.created_at?.toISOString().split('T')[0],
          max: dateRange._max.created_at?.toISOString().split('T')[0],
          dateRange: true,
        },
      ];

      const operators = {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        select: ['equals', 'in'],
      };

      return {
        filters: filtersList,
        operators,
        defaultSort: 'year:desc',
        searchFields: [
          'year',
          'payment_condition',
          'property_tax_cash',
          'property_tax_first_installment',
          'property_tax_second_installment',
        ],
      };

    } catch (error) {
      console.error('❌ Error getting IPTU property filters:', error);
      throw error;
    }
  }
}
