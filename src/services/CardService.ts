import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class CardService {
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  static async getCards(params: any = {}) {
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
          if (key === 'is_active') {
            where[key] = value === 'true' || value === true;
          }
        }
      });

      let cards: any[] = [];
      let total = 0;

      if (search.trim()) {
        const allCards = await prisma.card.findMany({ where });
        const normalizedSearch = this.normalizeText(search);
        
        let filtered = allCards.filter(card => {
          const normalizedName = this.normalizeText(card.name);
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
        
        cards = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        Object.entries(sortOptions).forEach(([field, direction]) => {
          if (['name', 'limit', 'is_active', 'created_at'].includes(field)) {
            orderBy.push({ [field]: this.normalizeSortDirection(direction as string) });
          }
        });
        if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });

        const [data, count] = await Promise.all([
          prisma.card.findMany({ where, skip, take, orderBy }),
          prisma.card.count({ where })
        ]);

        cards = data;
        total = count;
      }

      return {
        data: cards,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar cartões: ${error.message}`);
    }
  }

  static async getCardById(id: string) {
    try {
      const card = await prisma.card.findUnique({
        where: { id, deleted_at: null }
      });
      if (!card) throw new Error('Card not found');
      return card;
    } catch (error: any) { throw error; }
  }

  static async createCard(data: any) {
    try {
      const newCard = await prisma.card.create({
        data: { 
          name: data.name,
          limit: data.limit ? Number(data.limit) : null,
          is_active: data.is_active ?? true
        }
      });
      return newCard;
    } catch (error: any) { throw error; }
  }

  static async updateCard(id: string, data: any) {
    try {
      const existing = await prisma.card.findUnique({ where: { id, deleted_at: null } });
      if (!existing) throw new Error('Card not found');
      
      return await prisma.card.update({
        where: { id },
        data: { 
          name: data.name,
          limit: data.limit !== undefined ? (data.limit ? Number(data.limit) : null) : undefined,
          is_active: data.is_active
        }
      });
    } catch (error: any) { throw error; }
  }

  static async deleteCard(id: string) {
    try {
      const card = await prisma.card.findUnique({ where: { id, deleted_at: null } });
      if (!card) throw new Error('Card not found or already deleted');

      // Regra da Sprint de Março/2026: Bloquear exclusão se existirem lançamentos vinculados
      const hasTransactions = await prisma.transaction.findFirst({
        where: { card_id: id, deleted_at: null }
      });

      if (hasTransactions) {
        throw new Error('Não é possível excluir o cartão pois existem lançamentos relacionados.');
      }

      await prisma.card.update({
        where: { id },
        data: { deleted_at: new Date() }
      });

      return card;
    } catch (error: any) { throw error; }
  }

  static async restoreCard(id: string) {
    try {
      const card = await prisma.card.findUnique({ where: { id } });
      if (!card) throw new Error('Card not found');
      if (!card.deleted_at) throw new Error('Card is not deleted');

      return await prisma.card.update({
        where: { id },
        data: { deleted_at: null }
      });
    } catch (error: any) { throw error; }
  }

  static async getCardFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      const cards = await prisma.card.findMany({
        where, select: { name: true }, distinct: ['name']
      });

      return {
        filters: [
          { field: 'name', type: 'string', label: 'Nome do Cartão', values: [...new Set(cards.map(c => c.name))].sort(), searchable: true },
          { field: 'is_active', type: 'boolean', label: 'Ativo' }
        ],
        defaultSort: 'created_at:desc',
        searchFields: ['name']
      };
    } catch (error) { throw error; }
  }
}