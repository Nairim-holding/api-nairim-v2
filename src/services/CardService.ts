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

  private static filterCardsBySearch(cards: any[], searchTerm: string): any[] {
    if (!searchTerm.trim()) return cards;
    const normalizedSearchTerm = this.normalizeText(searchTerm);

    return cards.filter(card => {
      const statusPt = card.is_active ? 'ativo' : 'inativo';
      const formattedLimit = card.limit && Number(card.limit) > 0 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(card.limit)) 
        : 'sem limite';
        
      const fechamentoPt = card.closing_day ? `fechamento dia ${card.closing_day}` : '';
      const vencimentoPt = card.due_day ? `vencimento dia ${card.due_day}` : '';

      const fieldsToSearch = [
        card.name,
        String(card.limit),
        formattedLimit,
        String(card.closing_day),
        String(card.due_day),
        fechamentoPt,
        vencimentoPt,
        statusPt
      ].filter(Boolean).join(' ');

      return this.normalizeText(fieldsToSearch).includes(normalizedSearchTerm);
    });
  }

  static async getCards(params: any = {}) {
    try {
      const { limit = 30, page = 1, search = '', filters = {}, sortOptions = {}, includeInactive = false } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where: any = {};
      
      if (!includeInactive) where.deleted_at = null;

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (key === 'name') {
            where[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
          } else if (key === 'is_active') {
            where[key] = value === 'true' || value === true;
          } else if (key === 'closing_day') {
            where.closing_day = Number(value);
          } else if (key === 'due_day') {
            where.due_day = Number(value);
          } else if (key === 'card_limit') { 
            let strValue = String(value);
            if (strValue.includes(',')) {
              strValue = strValue.replace(/\./g, '').replace(',', '.');
            }
            const numericValue = Number(strValue.replace(/[^\d.-]/g, ''));
            
            if (!isNaN(numericValue)) {
              if (numericValue === 0) {
                where.OR = [
                  { limit: 0 },
                  { limit: null }
                ];
              } else {
                where.limit = numericValue;
              }
            }
          }
        }
      });

      let cards: any[] = [];
      let total = 0;

      if (search.trim()) {
        const allCards = await prisma.card.findMany({ where });
        
        let filtered = this.filterCardsBySearch(allCards, search);
        total = filtered.length;

        const sortEntries = Object.entries(sortOptions) as any;
        if (sortEntries.length > 0) {
          const field = sortEntries[0][0];
          const direction = this.normalizeSortDirection(sortEntries[0][1]);
          filtered = filtered.sort((a, b) => {
             const valA = (a as any)[field];
             const valB = (b as any)[field];
             
             if (typeof valA === 'number' || typeof valB === 'number') {
               return direction === 'asc' ? Number(valA || 0) - Number(valB || 0) : Number(valB || 0) - Number(valA || 0);
             }
             if (typeof valA === 'boolean' || typeof valB === 'boolean') {
               return direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
             }

             const strA = String(valA || '');
             const strB = String(valB || '');
             return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          });
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        
        cards = filtered.slice(skip, skip + take);
      } else {
        const orderBy: any[] = [];
        Object.entries(sortOptions).forEach(([field, direction]) => {
          if (['name', 'limit', 'closing_day', 'due_day', 'is_active', 'created_at'].includes(field)) {
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
          limit: data.limit !== null && data.limit !== undefined ? Number(data.limit) : undefined,
          closing_day: data.closing_day !== null && data.closing_day !== undefined ? Number(data.closing_day) : null,
          due_day: data.due_day !== null && data.due_day !== undefined ? Number(data.due_day) : null,
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
          limit: data.limit !== undefined ? (data.limit !== null ? Number(data.limit) : undefined) : undefined,
          closing_day: data.closing_day !== undefined ? (data.closing_day !== null ? Number(data.closing_day) : null) : undefined,
          due_day: data.due_day !== undefined ? (data.due_day !== null ? Number(data.due_day) : null) : undefined,
          is_active: data.is_active
        }
      });
    } catch (error: any) { throw error; }
  }

  static async deleteCard(id: string) {
    try {
      const card = await prisma.card.findUnique({ where: { id, deleted_at: null } });
      if (!card) throw new Error('Card not found or already deleted');

      const hasTransactions = await prisma.transaction.findFirst({
        where: { card_id: id, deleted_at: null }
      });

      if (hasTransactions) {
        throw new Error('Não é possível excluir o cartão pois existem lançamentos vinculados.');
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

  static async getCardFilters() {
    try {
      const existingCards = await prisma.card.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true, limit: true },
        orderBy: { name: 'asc' },
      });

      const uniqueNames = Array.from(new Set(existingCards.map(c => c.name)));
      const nameOptions = uniqueNames.map(name => ({ label: name, value: name }));

      const uniqueLimits = Array.from(
        new Set(
          existingCards
            .map(c => c.limit !== null && c.limit !== undefined ? Number(c.limit) : null)
            .filter(val => val !== null)
        )
      ).sort((a, b) => (a as number) - (b as number));

      const limitOptions = uniqueLimits.map(limit => ({
        label: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limit as number),
        value: String(limit) 
      }));

      const hasNoLimit = existingCards.some(c => !c.limit || Number(c.limit) === 0);
      if (hasNoLimit) {
        limitOptions.unshift({ label: 'Sem limite / R$ 0,00', value: '0' });
      }

      return {
        filters: [
          { 
            field: 'name', 
            type: 'select', 
            label: 'Nome do Cartão',
            values: nameOptions,
            searchable: true
          },
          { 
            field: 'is_active', 
            type: 'select', 
            label: 'Status', 
            values: [
              { value: 'true', label: 'Ativo' },
              { value: 'false', label: 'Inativo' }
            ] 
          },
          {
            field: 'card_limit', 
            type: 'select',
            label: 'Limite',
            values: limitOptions,
            searchable: true
          },
          { 
            field: 'created_at', 
            type: 'date', 
            label: 'Data de Criação', 
            dateRange: true 
          }
        ],
        defaultSort: 'created_at:desc',
        searchFields: ['name']
      };
    } catch (error) {
      throw error;
    }
  }
}