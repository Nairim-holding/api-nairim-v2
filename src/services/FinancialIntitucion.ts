import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class FinancialInstitutionService {
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  private static filterInstitutionsBySearch(institutions: any[], searchTerm: string): any[] {
    if (!searchTerm.trim()) return institutions;
    const normalizedSearchTerm = this.normalizeText(searchTerm);

    return institutions.filter(inst => {
      const fieldsToSearch = [
        inst.name,
        inst.bank_number,
        inst.agency_number,
        inst.account_number
      ].filter(Boolean).join(' ');

      return this.normalizeText(fieldsToSearch).includes(normalizedSearchTerm);
    });
  }

  static async getInstitutions(params: any = {}) {
    try {
      const { limit = 30, page = 1, search = '', filters = {}, sortOptions = {}, includeInactive = false } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where: any = {};
      if (!includeInactive) where.deleted_at = null;

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (key === 'name') {
            where[key] = String(value);
          } else if (['bank_number', 'agency_number', 'account_number'].includes(key)) {
            where[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
          } else if (key === 'is_active') {
            where[key] = value === 'true' || value === true; // Suporte para filtro de ativos/inativos
          }
        }
      });

      let institutions: any[] = [];
      let total = 0;

      if (search.trim()) {
        const allInstitutions = await prisma.financialInstitution.findMany({ where });
        
        let filtered = this.filterInstitutionsBySearch(allInstitutions, search);
        total = filtered.length;

        const sortEntries = Object.entries(sortOptions) as any;
        if (sortEntries.length > 0) {
          const field = sortEntries[0][0];
          const direction = this.normalizeSortDirection(sortEntries[0][1]);
            filtered = filtered.sort((a, b) => {
             const key = field as keyof typeof a;
             const strA = this.normalizeText(String(a[key] || ''));
             const strB = this.normalizeText(String(b[key] || ''));
             return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          });
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        
        institutions = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        Object.entries(sortOptions).forEach(([field, direction]) => {
          if (['name', 'bank_number', 'agency_number', 'account_number', 'created_at', 'is_active'].includes(field)) {
            orderBy.push({ [field]: this.normalizeSortDirection(direction as string) });
          }
        });
        if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });

        const [data, count] = await Promise.all([
          prisma.financialInstitution.findMany({ where, skip, take, orderBy }),
          prisma.financialInstitution.count({ where })
        ]);

        institutions = data;
        total = count;
      }

      return {
        data: institutions,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar instituições: ${error.message}`);
    }
  }

  static async getInstitutionById(id: string) {
    try {
      const institution = await prisma.financialInstitution.findUnique({
        where: { id, deleted_at: null }
      });
      if (!institution) throw new Error('Institution not found');
      return institution;
    } catch (error: any) { throw error; }
  }

  static async createInstitution(data: any) {
    try {
      const newInstitution = await prisma.financialInstitution.create({
        data: { 
          name: data.name,
          bank_number: data.bank_number || null,
          agency_number: data.agency_number || null,
          account_number: data.account_number || null,
          is_active: data.is_active !== undefined ? Boolean(data.is_active) : true // <-- CORRIGIDO AQUI
        }
      });
      return newInstitution;
    } catch (error: any) { throw error; }
  }

  static async updateInstitution(id: string, data: any) {
    try {
      const existing = await prisma.financialInstitution.findUnique({ where: { id, deleted_at: null } });
      if (!existing) throw new Error('Institution not found');

      return await prisma.financialInstitution.update({
        where: { id },
        data: { 
          name: data.name !== undefined ? data.name : undefined,
          bank_number: data.bank_number !== undefined ? data.bank_number : undefined,
          agency_number: data.agency_number !== undefined ? data.agency_number : undefined,
          account_number: data.account_number !== undefined ? data.account_number : undefined,
          is_active: data.is_active !== undefined ? Boolean(data.is_active) : undefined // <-- CORRIGIDO AQUI
        }
      });
    } catch (error: any) { throw error; }
  }

  static async deleteInstitution(id: string) {
    try {
      const institution = await prisma.financialInstitution.findUnique({ where: { id, deleted_at: null } });
      if (!institution) throw new Error('Institution not found or already deleted');

      const hasTransactions = await prisma.transaction.findFirst({
        where: { financial_institution_id: id, deleted_at: null }
      });

      if (hasTransactions) {
        throw new Error('Não é possível excluir a instituição financeira pois existem lançamentos relacionados.');
      }

      await prisma.financialInstitution.update({
        where: { id },
        data: { deleted_at: new Date() }
      });

      return institution;
    } catch (error: any) { throw error; }
  }

  static async restoreInstitution(id: string) {
    try {
      const institution = await prisma.financialInstitution.findUnique({ where: { id } });
      if (!institution) throw new Error('Institution not found');
      if (!institution.deleted_at) throw new Error('Institution is not deleted');

      return await prisma.financialInstitution.update({
        where: { id },
        data: { deleted_at: null }
      });
    } catch (error: any) { throw error; }
  }

  static async quickCreate(data: { name: string }) {
    try {
      const name = String(data.name ?? '').trim();
      if (!name) throw new Error('Nome é obrigatório');

      const existing = await prisma.financialInstitution.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, deleted_at: null }
      });
      if (existing) return existing;

      return await prisma.financialInstitution.create({
        data: {
          name,
          is_active: true
        }
      });
    } catch (error: any) {
      throw new Error(`Falha ao criar instituição rápida: ${error.message}`);
    }
  }

  static async getInstitutionFilters() {
    try {
      const where: any = { deleted_at: null };
      const institutions = await prisma.financialInstitution.findMany({
        where, select: { name: true }, orderBy: { name: 'asc' }
      });

      const uniqueNames = Array.from(new Set(institutions.map(i => i.name)));
      const nameOptions = uniqueNames.map(name => ({ label: name, value: name }));

      return {
        filters: [
          { 
            field: 'name', 
            type: 'select', 
            label: 'Nome da Instituição', 
            values: nameOptions, 
            searchable: true 
          },
          {
            field: 'is_active',
            type: 'select',
            label: 'Status',
            values: [
              { label: 'Ativo', value: 'true' },
              { label: 'Inativo', value: 'false' }
            ]
          }
        ],
        defaultSort: 'created_at:desc',
        searchFields: ['name', 'bank_number', 'agency_number', 'account_number']
      };
    } catch (error) { throw error; }
  }
}