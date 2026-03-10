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

  static async getInstitutions(params: any = {}) {
    try {
      const { limit = 30, page = 1, search = '', filters = {}, sortOptions = {}, includeInactive = false } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where: any = {};
      if (!includeInactive) where.deleted_at = null;

      // Filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          if (key === 'name') {
            where[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
          }
        }
      });

      // Busca e Ordenação
      let institutions: any[] = [];
      let total = 0;

      if (search.trim()) {
        const allInstitutions = await prisma.financialInstitution.findMany({ where });
        const normalizedSearch = this.normalizeText(search);
        
        let filtered = allInstitutions.filter(inst => {
          const normalizedName = this.normalizeText(inst.name);
          return normalizedName.includes(normalizedSearch);
        });

        total = filtered.length;

        const sortEntries = Object.entries(sortOptions) as any;
        if (sortEntries.length > 0) {
          const field = sortEntries[0][0];
          const direction = this.normalizeSortDirection(sortEntries[0][1]);
            filtered = filtered.sort((a, b) => {
             const key = field as keyof typeof a;
             const strA = String(a[key] || '');
             const strB = String(b[key] || '');
             return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          });
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        
        institutions = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        Object.entries(sortOptions).forEach(([field, direction]) => {
          if (['name', 'created_at'].includes(field)) {
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
        data: { name: data.name }
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
        data: { name: data.name }
      });
    } catch (error: any) { throw error; }
  }

  static async deleteInstitution(id: string) {
    try {
      const institution = await prisma.financialInstitution.findUnique({ where: { id, deleted_at: null } });
      if (!institution) throw new Error('Institution not found or already deleted');

      // Regra de negócio: não excluir se houver lançamentos
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

  static async getInstitutionFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      const institutions = await prisma.financialInstitution.findMany({
        where, select: { name: true }, distinct: ['name']
      });

      return {
        filters: [
          { field: 'name', type: 'string', label: 'Nome da Instituição', values: [...new Set(institutions.map(i => i.name))].sort(), searchable: true }
        ],
        defaultSort: 'created_at:desc',
        searchFields: ['name']
      };
    } catch (error) { throw error; }
  }
}