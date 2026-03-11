import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class SubcategoryService {
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  static async getSubcategories(params: any = {}) {
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
          if (key === 'category_id') {
            where[key] = String(value);
          }
          if (key === 'is_active') {
            where[key] = value === 'true' || value === true;
          }
        }
      });

      let subcategories: any[] = [];
      let total = 0;

      if (search.trim()) {
        const allSubcategories = await prisma.subcategory.findMany({ 
          where,
          include: { category: true } // Inclui a categoria pai
        });
        const normalizedSearch = this.normalizeText(search);
        
        let filtered = allSubcategories.filter(sub => {
          const normalizedName = this.normalizeText(sub.name);
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
        
        subcategories = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        Object.entries(sortOptions).forEach(([field, direction]) => {
          if (['name', 'is_active', 'created_at'].includes(field)) {
            orderBy.push({ [field]: this.normalizeSortDirection(direction as string) });
          }
        });
        if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });

        const [data, count] = await Promise.all([
          prisma.subcategory.findMany({ 
            where, skip, take, orderBy,
            include: { category: true } 
          }),
          prisma.subcategory.count({ where })
        ]);

        subcategories = data;
        total = count;
      }

      return {
        data: subcategories,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar subcategorias: ${error.message}`);
    }
  }

  static async getSubcategoryById(id: string) {
    try {
      const subcategory = await prisma.subcategory.findUnique({
        where: { id, deleted_at: null },
        include: { category: true }
      });
      if (!subcategory) throw new Error('Subcategory not found');
      return subcategory;
    } catch (error: any) { throw error; }
  }

  static async createSubcategory(data: any) {
    try {
      // Verifica se a categoria pai existe
      const categoryExists = await prisma.category.findUnique({ 
        where: { id: data.category_id, deleted_at: null } 
      });
      if (!categoryExists) throw new Error('Categoria pai não encontrada');

      const newSubcategory = await prisma.subcategory.create({
        data: { 
          name: data.name,
          category_id: data.category_id,
          is_active: data.is_active ?? true
        }
      });
      return newSubcategory;
    } catch (error: any) { throw error; }
  }

  static async updateSubcategory(id: string, data: any) {
    try {
      const existing = await prisma.subcategory.findUnique({ where: { id, deleted_at: null } });
      if (!existing) throw new Error('Subcategory not found');
      
      if (data.category_id && data.category_id !== existing.category_id) {
        const categoryExists = await prisma.category.findUnique({ 
          where: { id: data.category_id, deleted_at: null } 
        });
        if (!categoryExists) throw new Error('Categoria pai não encontrada');
      }

      return await prisma.subcategory.update({
        where: { id },
        data: { 
          name: data.name,
          category_id: data.category_id,
          is_active: data.is_active
        }
      });
    } catch (error: any) { throw error; }
  }

  static async deleteSubcategory(id: string) {
    try {
      const subcategory = await prisma.subcategory.findUnique({ where: { id, deleted_at: null } });
      if (!subcategory) throw new Error('Subcategory not found or already deleted');

      // Regra do Financeiro: não excluir se houver lançamentos vinculados
      const hasTransactions = await prisma.transaction.findFirst({
        where: { subcategory_id: id, deleted_at: null }
      });

      if (hasTransactions) {
        throw new Error('Não é possível excluir a subcategoria pois existem lançamentos relacionados.');
      }

      await prisma.subcategory.update({
        where: { id },
        data: { deleted_at: new Date() }
      });

      return subcategory;
    } catch (error: any) { throw error; }
  }

  static async restoreSubcategory(id: string) {
    try {
      const subcategory = await prisma.subcategory.findUnique({ where: { id } });
      if (!subcategory) throw new Error('Subcategory not found');
      if (!subcategory.deleted_at) throw new Error('Subcategory is not deleted');

      return await prisma.subcategory.update({
        where: { id },
        data: { deleted_at: null }
      });
    } catch (error: any) { throw error; }
  }

  static async getSubcategoryFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      const subcategories = await prisma.subcategory.findMany({
        where, select: { name: true }, distinct: ['name']
      });
      
      // Busca categorias para popular o filtro de category_id
      const categories = await prisma.category.findMany({
        where: { deleted_at: null }, select: { id: true, name: true, type: true }
      });

      return {
        filters: [
          { field: 'name', type: 'string', label: 'Nome da Subcategoria', values: [...new Set(subcategories.map(s => s.name))].sort(), searchable: true },
          { field: 'category_id', type: 'select', label: 'Categoria', values: categories.map(c => ({ value: c.id, label: `${c.name} (${c.type})` })) },
          { field: 'is_active', type: 'boolean', label: 'Ativo' }
        ],
        defaultSort: 'created_at:desc',
        searchFields: ['name']
      };
    } catch (error) { throw error; }
  }
}