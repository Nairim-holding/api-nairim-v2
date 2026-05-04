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

  private static safeGetProperty(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
  }

  private static filterSubcategoriesBySearch(subcategories: any[], searchTerm: string): any[] {
    if (!searchTerm.trim()) return subcategories;
    const normalizedSearchTerm = this.normalizeText(searchTerm);

    return subcategories.filter(sub => {
      const statusPt = sub.is_active ? 'ativo' : 'inativo';
      const typePt = sub.category?.type === 'INCOME' ? 'receita' : (sub.category?.type === 'EXPENSE' ? 'despesa' : '');
      
      const fieldsToSearch = [
        sub.name,
        sub.category?.name,
        typePt,
        statusPt
      ].filter(Boolean).join(' ');

      return this.normalizeText(fieldsToSearch).includes(normalizedSearchTerm);
    });
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
          } else if (key === 'category_id') {
            where[key] = String(value);
          } else if (key === 'is_active') {
            where[key] = value === 'true' || value === true;
          }
        }
      });

      let subcategories: any[] = [];
      let total = 0;

      if (search.trim()) {
        const allSubcategories = await prisma.subcategory.findMany({ 
          where,
          include: { category: true }
        });
        
        let filtered = this.filterSubcategoriesBySearch(allSubcategories, search);
        total = filtered.length;

        const sortEntries = Object.entries(sortOptions) as any;
        if (sortEntries.length > 0) {
          const field = sortEntries[0][0];
          const direction = this.normalizeSortDirection(sortEntries[0][1]);
          filtered = filtered.sort((a, b) => {
             const realField = field === 'category_id' ? 'category.name' : field;
             
             let valA = this.safeGetProperty(a, realField);
             let valB = this.safeGetProperty(b, realField);

             if (valA === undefined) valA = (a as any)[field];
             if (valB === undefined) valB = (b as any)[field];

             if (typeof valA === 'boolean' || typeof valB === 'boolean') {
               return direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
             }

             const strA = this.normalizeText(String(valA || ''));
             const strB = this.normalizeText(String(valB || ''));
             return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          });
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        
        subcategories = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        Object.entries(sortOptions).forEach(([field, direction]) => {
          const dir = this.normalizeSortDirection(direction as string);
          
          if (['name', 'is_active', 'created_at'].includes(field)) {
            orderBy.push({ [field]: dir });
          } else if (field === 'category_id') {
            orderBy.push({ category: { name: dir } }); // Ensina o Prisma a ordenar pelo nome da categoria
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

  static async quickCreate(data: { name: string, category_id: string }) {
    try {
      const name = String(data.name ?? '').trim();
      const categoryId = String(data.category_id ?? '').trim();
      if (!name) throw new Error('Nome é obrigatório');
      if (!categoryId) throw new Error('Categoria pai é obrigatória');

      const existing = await prisma.subcategory.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, category_id: categoryId, deleted_at: null }
      });
      if (existing) return existing;

      return await prisma.subcategory.create({
        data: {
          name,
          category_id: categoryId,
          is_active: true
        }
      });
    } catch (error: any) {
      throw new Error(`Falha ao criar subcategoria rápida: ${error.message}`);
    }
  }

  static async getSubcategoryFilters() {
    try {
      const where: any = { deleted_at: null };
      const subcategories = await prisma.subcategory.findMany({
        where, select: { name: true }, orderBy: { name: 'asc' }
      });
      
      const categories = await prisma.category.findMany({
        where: { deleted_at: null }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' }
      });

      const uniqueNames = Array.from(new Set(subcategories.map(s => s.name)));
      const nameOptions = uniqueNames.map(name => ({ label: name, value: name }));

      const categoryOptions = categories.map(c => {
        const tipoTraduzido = c.type === 'INCOME' ? 'Receita' : 'Despesa';
        return { 
          label: `${c.name} (${tipoTraduzido})`, 
          value: c.id 
        };
      });

      return {
        filters: [
          { 
            field: 'name', 
            type: 'select',
            label: 'Nome da Subcategoria', 
            values: nameOptions,
            searchable: true
          },
          { 
            field: 'category_id', 
            type: 'select', 
            label: 'Categoria Pai', 
            values: categoryOptions 
          },
          { 
            field: 'is_active', 
            type: 'select', 
            label: 'Status',
            values: [
              { value: 'true', label: 'Ativo' },
              { value: 'false', label: 'Inativo' }
            ]
          }
        ],
        defaultSort: 'created_at:desc',
        searchFields: ['name']
      };
    } catch (error) { throw error; }
  }
}