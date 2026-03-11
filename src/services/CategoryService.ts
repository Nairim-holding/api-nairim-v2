import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class CategoryService {
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  static async getCategories(params: any = {}) {
    try {
      const { limit = 30, page = 1, search = '', filters = {}, sortOptions = {}, includeInactive = false } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where: any = {};
      
      // Se includeInactive for false, traz apenas os que não foram deletados
      if (!includeInactive) where.deleted_at = null;

      // Filtros exatos
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

      let categories: any[] = [];
      let total = 0;

      if (search.trim()) {
        const allCategories = await prisma.category.findMany({ where });
        const normalizedSearch = this.normalizeText(search);
        
        let filtered = allCategories.filter(cat => {
          const normalizedName = this.normalizeText(cat.name);
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
        
        categories = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        Object.entries(sortOptions).forEach(([field, direction]) => {
          if (['name', 'type', 'is_active', 'created_at'].includes(field)) {
            orderBy.push({ [field]: this.normalizeSortDirection(direction as string) });
          }
        });
        if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });

        const [data, count] = await Promise.all([
          prisma.category.findMany({ where, skip, take, orderBy }),
          prisma.category.count({ where })
        ]);

        categories = data;
        total = count;
      }

      return {
        data: categories,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar categorias: ${error.message}`);
    }
  }

  static async getCategoryById(id: string) {
    try {
      const category = await prisma.category.findUnique({
        where: { id, deleted_at: null },
        include: {
          subcategories: { where: { deleted_at: null } }
        }
      });
      if (!category) throw new Error('Category not found');
      return category;
    } catch (error: any) { throw error; }
  }

  static async createCategory(data: any) {
    try {
      const newCategory = await prisma.category.create({
        data: { 
          name: data.name,
          type: data.type,
          is_active: data.is_active ?? true,
          is_system: false // Categorias criadas pelo usuário nunca são de sistema
        }
      });
      return newCategory;
    } catch (error: any) { throw error; }
  }

  static async updateCategory(id: string, data: any) {
    try {
      const existing = await prisma.category.findUnique({ where: { id, deleted_at: null } });
      if (!existing) throw new Error('Category not found');
      
      // Regra de segurança: Não permitir alteração de categorias de sistema (ex: Transferências)
      if (existing.is_system) {
        throw new Error('Não é possível alterar categorias internas do sistema.');
      }

      return await prisma.category.update({
        where: { id },
        data: { 
          name: data.name,
          type: data.type,
          is_active: data.is_active
        }
      });
    } catch (error: any) { throw error; }
  }

  static async deleteCategory(id: string) {
    try {
      const category = await prisma.category.findUnique({ where: { id, deleted_at: null } });
      if (!category) throw new Error('Category not found or already deleted');

      // Regra de segurança: Não permitir exclusão de categorias de sistema
      if (category.is_system) {
        throw new Error('Não é possível excluir categorias internas do sistema.');
      }

      // Regra do Financeiro: não excluir se houver lançamentos ou subcategorias vinculadas
      const hasTransactions = await prisma.transaction.findFirst({
        where: { category_id: id, deleted_at: null }
      });

      if (hasTransactions) {
        throw new Error('Não é possível excluir a categoria pois existem lançamentos relacionados.');
      }

      const hasSubcategories = await prisma.subcategory.findFirst({
        where: { category_id: id, deleted_at: null }
      });

      if (hasSubcategories) {
        throw new Error('Não é possível excluir a categoria pois existem subcategorias vinculadas.');
      }

      await prisma.category.update({
        where: { id },
        data: { deleted_at: new Date() }
      });

      return category;
    } catch (error: any) { throw error; }
  }

  static async restoreCategory(id: string) {
    try {
      const category = await prisma.category.findUnique({ where: { id } });
      if (!category) throw new Error('Category not found');
      if (!category.deleted_at) throw new Error('Category is not deleted');

      return await prisma.category.update({
        where: { id },
        data: { deleted_at: null }
      });
    } catch (error: any) { throw error; }
  }

  static async getCategoryFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      const categories = await prisma.category.findMany({
        where, select: { name: true }, distinct: ['name']
      });

      return {
        filters: [
          { field: 'name', type: 'string', label: 'Nome da Categoria', values: [...new Set(categories.map(c => c.name))].sort(), searchable: true },
          { field: 'type', type: 'select', label: 'Tipo', values: ['INCOME', 'EXPENSE'] },
          { field: 'is_active', type: 'boolean', label: 'Ativo' }
        ],
        defaultSort: 'created_at:desc',
        searchFields: ['name']
      };
    } catch (error) { throw error; }
  }
}