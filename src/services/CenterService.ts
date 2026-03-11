import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class CenterService {
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  static async getCenters(params: any = {}) {
    try {
      const { limit = 30, page = 1, search = '', filters = {}, sortOptions = {}, includeInactive = false } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where: any = {};
      
      if (!includeInactive) where.deleted_at = null;

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          if (key === 'name') {
            where[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
          }
          if (key === 'type') {
            where[key] = value;
          }
          if (key === 'is_active') {
            where[key] = value === 'true' || value === true;
          }
        }
      });

      let centers: any[] = [];
      let total = 0;

      if (search.trim()) {
        const allCenters = await prisma.center.findMany({ where });
        const normalizedSearch = this.normalizeText(search);
        
        let filtered = allCenters.filter(center => {
          const normalizedName = this.normalizeText(center.name);
          return normalizedName.includes(normalizedSearch);
        });

        total = filtered.length;

        const sortEntries = Object.entries(sortOptions) as any;
        if (sortEntries.length > 0) {
          const field = sortEntries[0][0];
          const direction = this.normalizeSortDirection(sortEntries[0][1]);
          filtered = filtered.sort((a, b) => {
             const strA = String((a as any)[field] || '');
             const strB = String((b as any)[field] || '');
             return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          });
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        
        centers = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        Object.entries(sortOptions).forEach(([field, direction]) => {
          if (['name', 'type', 'is_active', 'created_at'].includes(field)) {
            orderBy.push({ [field]: this.normalizeSortDirection(direction as string) });
          }
        });
        if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });

        const [data, count] = await Promise.all([
          prisma.center.findMany({ where, skip, take, orderBy }),
          prisma.center.count({ where })
        ]);

        centers = data;
        total = count;
      }

      return {
        data: centers,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar centros: ${error.message}`);
    }
  }

  static async getCenterById(id: string) {
    try {
      const center = await prisma.center.findUnique({
        where: { id, deleted_at: null }
      });
      if (!center) throw new Error('Center not found');
      return center;
    } catch (error: any) { throw error; }
  }

  static async createCenter(data: any) {
    try {
      const newCenter = await prisma.center.create({
        data: { 
          name: data.name,
          type: data.type,
          is_active: data.is_active ?? true
        }
      });
      return newCenter;
    } catch (error: any) { throw error; }
  }

  static async updateCenter(id: string, data: any) {
    try {
      const existing = await prisma.center.findUnique({ where: { id, deleted_at: null } });
      if (!existing) throw new Error('Center not found');
      
      return await prisma.center.update({
        where: { id },
        data: { 
          name: data.name,
          type: data.type,
          is_active: data.is_active
        }
      });
    } catch (error: any) { throw error; }
  }

  static async deleteCenter(id: string) {
    try {
      const center = await prisma.center.findUnique({ where: { id, deleted_at: null } });
      if (!center) throw new Error('Center not found or already deleted');

      // Regra da Sprint: Bloquear exclusão se existirem lançamentos vinculados
      const hasTransactions = await prisma.transaction.findFirst({
        where: { center_id: id, deleted_at: null }
      });

      if (hasTransactions) {
        throw new Error('Não é possível excluir o centro pois existem lançamentos relacionados.');
      }

      await prisma.center.update({
        where: { id },
        data: { deleted_at: new Date() }
      });

      return center;
    } catch (error: any) { throw error; }
  }

  static async restoreCenter(id: string) {
    try {
      const center = await prisma.center.findUnique({ where: { id } });
      if (!center) throw new Error('Center not found');
      if (!center.deleted_at) throw new Error('Center is not deleted');

      return await prisma.center.update({
        where: { id },
        data: { deleted_at: null }
      });
    } catch (error: any) { throw error; }
  }

  static async getCenterFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      const centers = await prisma.center.findMany({
        where, select: { name: true }, distinct: ['name']
      });

      return {
        filters: [
          { field: 'name', type: 'string', label: 'Nome do Centro', values: [...new Set(centers.map(c => c.name))].sort(), searchable: true },
          { field: 'type', type: 'select', label: 'Tipo', values: ['INCOME', 'EXPENSE'] },
          { field: 'is_active', type: 'boolean', label: 'Ativo' }
        ],
        defaultSort: 'created_at:desc',
        searchFields: ['name']
      };
    } catch (error) { throw error; }
  }
}