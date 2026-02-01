// services/PropertyTypeService.ts
import prisma from '../lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { GetPropertyTypesParams, PaginatedPropertyTypeResponse } from '../types/property-type';

export class PropertyTypeService {
  // Método para normalizar texto (remover acentos e caracteres especiais)
  private static normalizeText(text: string): string {
    if (!text) return '';
    
    // Normaliza para a forma NFD (Decomposição) e remove os diacríticos
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
      .replace(/[çÇ]/g, 'c')             // Substitui ç por c
      .replace(/[ñÑ]/g, 'n')             // Substitui ñ por n
      .toLowerCase()
      .trim();
  }

  // Método auxiliar para normalizar direção de ordenação
  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    if (direction.toLowerCase() === 'desc') {
      return 'desc';
    }
    return 'asc'; // default
  }

  static async getPropertyTypes(params: GetPropertyTypesParams = {}): Promise<PaginatedPropertyTypeResponse> {
    try {
      console.log('🔍 Executing getPropertyTypes with params:', JSON.stringify(params, null, 2));
      
      const { 
        limit = 30, 
        page = 1, 
        search = '',
        filters = {},
        sortOptions = {},
        includeInactive = false 
      } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      // Construir where clause sem busca global (busca será feita em memória)
      const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);
      
      // Verificar tipo de ordenação
      const sortEntries = Object.entries(sortOptions);
      const sortField = sortEntries.length > 0 ? sortEntries[0][0] : '';
      const sortDirection = sortEntries.length > 0 ? 
        this.normalizeSortDirection(sortEntries[0][1]) : 'asc';
      
      console.log(`🔧 Campo de ordenação: ${sortField} -> ${sortDirection}`);

      let propertyTypes: any[] = [];
      let total = 0;

      // Se houver busca, processar em memória
      if (search.trim()) {
        console.log(`🔄 Processando busca em memória: "${search}"`);
        
        // Buscar TODOS os property types para processamento em memória
        const allPropertyTypes = await prisma.propertyType.findMany({
          where,
          select: {
            id: true,
            description: true,
            created_at: true,
            updated_at: true,
            deleted_at: true,
          },
        });

        // Aplicar filtro de busca em memória
        const filteredPropertyTypes = this.filterPropertyTypesBySearch(allPropertyTypes, search);
        total = filteredPropertyTypes.length;

        // Ordenar em memória se necessário
        if (sortField && sortDirection) {
          propertyTypes = this.sortPropertyTypes(filteredPropertyTypes, sortField, sortDirection);
        } else {
          // Ordenação padrão por descrição
          propertyTypes = filteredPropertyTypes.sort((a, b) => 
            this.normalizeText(a.description).localeCompare(this.normalizeText(b.description), 'pt-BR', { sensitivity: 'base' })
          );
        }
        
        // Aplicar paginação
        propertyTypes = propertyTypes.slice(skip, skip + take);
      } else {
        // Sem busca, fazer query normal
        const orderBy = this.buildOrderBy(sortOptions);
        
        console.log('📊 ORDER BY:', JSON.stringify(orderBy, null, 2));
        
        // Buscar com ordenação do Prisma
        const [propertyTypesData, totalCount] = await Promise.all([
          prisma.propertyType.findMany({
            where,
            skip,
            take,
            orderBy,
            select: {
              id: true,
              description: true,
              created_at: true,
              updated_at: true,
              deleted_at: true,
            },
          }),
          prisma.propertyType.count({ where })
        ]);

        propertyTypes = propertyTypesData;
        total = totalCount;
      }

      console.log(`✅ Found ${propertyTypes.length} property types, total: ${total}`);

      return {
        data: propertyTypes || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in PropertyTypeService.getPropertyTypes:', error);
      throw new Error(`Failed to fetch property types: ${error.message}`);
    }
  }

  /**
   * Filtra property types em memória com base no termo de busca (ignorando acentos)
   */
  private static filterPropertyTypesBySearch(
    propertyTypes: any[],
    searchTerm: string
  ): any[] {
    if (!searchTerm.trim()) return propertyTypes;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return propertyTypes.filter(propertyType => {
      // Campos para busca
      const searchFields = [
        propertyType.description
      ].filter(Boolean).join(' ');

      // Normalizar e verificar se contém o termo de busca
      const normalizedFields = this.normalizeText(searchFields);
      return normalizedFields.includes(normalizedSearchTerm);
    });
  }

  /**
   * Ordenação de property types em memória
   */
  private static sortPropertyTypes(
    items: any[],
    field: string,
    direction: 'asc' | 'desc'
  ): any[] {
    return [...items].sort((a, b) => {
      let valueA = a[field] || '';
      let valueB = b[field] || '';

      // Se for campo de texto, normalizar para ordenação
      if (field === 'description') {
        valueA = this.normalizeText(String(valueA));
        valueB = this.normalizeText(String(valueB));
      }

      if (direction === 'asc') {
        return valueA.localeCompare(valueB, 'pt-BR', { sensitivity: 'base' });
      } else {
        return valueB.localeCompare(valueA, 'pt-BR', { sensitivity: 'base' });
      }
    });
  }

  /**
   * Constrói a cláusula WHERE para a query (sem busca global)
   */
  private static buildWhereClauseWithoutSearch(
    filters: Record<string, any>,
    includeInactive: boolean
  ): any {
    const where: any = {};
    
    // Por padrão, não mostra deletados
    if (!includeInactive) {
      where.deleted_at = null;
    }
    
    // Filtros específicos
    const filterConditions = this.buildFilterConditions(filters);
    if (Object.keys(filterConditions).length > 0) {
      where.AND = [filterConditions];
    }
    
    return where;
  }

  /**
   * Constrói condições de filtro específicas
   */
  private static buildFilterConditions(filters: Record<string, any>): any {
    const conditions: any = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        console.log(`⚠️  Valor vazio para filtro ${key}:`, value);
        return;
      }

      console.log(`🔄 Aplicando filtro ${key}:`, value);

      // Para campos diretos
      if (['description'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      // Para campos de data
      else if (key === 'created_at') {
        conditions[key] = this.buildDateCondition(value);
      }
    });
    
    return conditions;
  }

  /**
   * Constrói condição para filtro de data
   */
  private static buildDateCondition(value: any): any {
    if (typeof value === 'object' && value && 'from' in value && 'to' in value) {
      const dateRange = value as { from: string; to: string };
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        return {
          gte: fromDate,
          lte: toDate
        };
      }
    } 
    else if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        return {
          gte: startOfDay,
          lte: endOfDay
        };
      }
    }
    
    return {};
  }

  /**
   * Constrói ORDER BY
   */
  private static buildOrderBy(sortOptions: Record<string, string>): any[] {
    const orderBy: any[] = [];

    Object.entries(sortOptions).forEach(([key, value]) => {
      if (!value) return;

      const direction = this.normalizeSortDirection(value);
      const field = key.replace('sort_', '');

      console.log(`🔧 Processando ordenação: ${field} -> ${direction}`);

      // Campos diretos
      if (['description', 'created_at', 'updated_at'].includes(field)) {
        orderBy.push({ [field]: direction });
      }
    });

    if (orderBy.length === 0) {
      orderBy.push({ description: 'asc' });
    }

    return orderBy;
  }

  static async getPropertyTypeById(id: string) {
    try {
      console.log(`🔍 Getting property type by ID: ${id}`);
      
      const propertyType = await prisma.propertyType.findUnique({
        where: { 
          id,
          deleted_at: null // Só retorna se não estiver deletado
        },
      });

      if (!propertyType) {
        throw new Error('Property type not found');
      }

      console.log(`✅ Found property type: ${propertyType.description}`);
      return propertyType;

    } catch (error: any) {
      console.error(`❌ Error getting property type ${id}:`, error);
      throw error;
    }
  }

  static async createPropertyType(data: any) {
    try {
      console.log('➕ Creating new property type:', data.description);
      
      // Verificar se já existe (não deletado)
      const existing = await prisma.propertyType.findFirst({
        where: { 
          description: data.description,
          deleted_at: null
        }
      });

      if (existing) {
        throw new Error('Property type already exists');
      }

      const propertyType = await prisma.propertyType.create({
        data: {
          description: data.description,
        }
      });

      console.log(`✅ Property type created: ${propertyType.id}`);
      return propertyType;

    } catch (error: any) {
      console.error('❌ Error creating property type:', error);
      throw error;
    }
  }

  static async updatePropertyType(id: string, data: any) {
    try {
      console.log(`✏️ Updating property type: ${id}`);
      
      // Verificar se existe e não está deletada
      const existing = await prisma.propertyType.findUnique({ 
        where: { 
          id,
          deleted_at: null 
        } 
      });
      
      if (!existing) {
        throw new Error('Property type not found');
      }

      // Verificar se nova descrição já existe (não deletada)
      if (data.description && data.description !== existing.description) {
        const descriptionExists = await prisma.propertyType.findFirst({
          where: { 
            description: data.description,
            deleted_at: null,
            NOT: { id }
          }
        });
        
        if (descriptionExists) {
          throw new Error('Property type already exists');
        }
      }

      const propertyType = await prisma.propertyType.update({
        where: { id },
        data: {
          description: data.description,
        }
      });

      console.log(`✅ Property type updated: ${propertyType.id}`);
      return propertyType;

    } catch (error: any) {
      console.error(`❌ Error updating property type ${id}:`, error);
      throw error;
    }
  }

  static async deletePropertyType(id: string) {
    try {
      console.log(`🗑️ Soft deleting property type: ${id}`);
      
      // Verificar se o tipo de propriedade existe e não está deletado
      const propertyType = await prisma.propertyType.findUnique({
        where: { 
          id,
          deleted_at: null
        },
      });

      if (!propertyType) {
        throw new Error('Property type not found or already deleted');
      }

      // SOFT DELETE: atualizar o campo deleted_at
      await prisma.$transaction(async (tx: any) => {
        // Soft delete do tipo de propriedade
        await tx.propertyType.update({
          where: { id },
          data: { 
            deleted_at: new Date(),
          },
        });

        // Soft delete das propriedades relacionadas que não estão deletadas
        await tx.property.updateMany({
          where: { 
            type_id: id,
            deleted_at: null 
          },
          data: { 
            deleted_at: new Date() 
          }
        });

        // Soft delete dos leases relacionados que não estão deletados
        await tx.lease.updateMany({
          where: { 
            type_id: id,
            deleted_at: null 
          },
          data: { 
            deleted_at: new Date() 
          }
        });
      });

      console.log(`✅ Property type soft deleted: ${id}`);
      return propertyType;

    } catch (error: any) {
      console.error(`❌ Error soft deleting property type ${id}:`, error);
      throw error;
    }
  }

  static async restorePropertyType(id: string) {
    try {
      console.log(`♻️ Restoring property type: ${id}`);
      
      // Verificar se o tipo de propriedade existe
      const propertyType = await prisma.propertyType.findUnique({
        where: { id },
      });

      if (!propertyType) {
        throw new Error('Property type not found');
      }

      if (!propertyType.deleted_at) {
        throw new Error('Property type is not deleted');
      }

      // Restaurar: setar deleted_at para null
      await prisma.propertyType.update({
        where: { id },
        data: { 
          deleted_at: null,
        }
      });
      
      console.log(`✅ Property type restored: ${id}`);
      return propertyType;

    } catch (error: any) {
      console.error(`❌ Error restoring property type ${id}:`, error);
      throw error;
    }
  }

  static async getPropertyTypeFilters(filters?: Record<string, any>) {
    try {
      console.log('🔍 Building property type filters with context...');
      console.log('📦 Active filters for context:', filters);

      // Construir where clause com base nos filtros atuais
      const where: any = { deleted_at: null };
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (['description'].includes(key)) {
              where[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
            }
          }
        });
      }

      console.log('📊 WHERE clause para filtros contextuais:', JSON.stringify(where, null, 2));

      // Buscar todos os tipos de propriedade únicos
      const propertyTypes = await prisma.propertyType.findMany({
        where,
        select: { description: true },
        distinct: ['description'],
        orderBy: { description: 'asc' }
      });

      // Data range para filtros de data
      const dateRange = await prisma.propertyType.aggregate({
        where,
        _min: { created_at: true },
        _max: { created_at: true }
      });

      const filtersList = [
        {
          field: 'description',
          type: 'string',
          label: 'Descrição',
          description: 'Tipo de propriedade',
          values: propertyTypes
            .filter(pt => pt.description)
            .map(pt => pt.description.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'created_at',
          type: 'date',
          label: 'Data de Criação',
          description: 'Data de cadastro no sistema',
          min: dateRange._min.created_at?.toISOString().split('T')[0],
          max: dateRange._max.created_at?.toISOString().split('T')[0],
          dateRange: true
        }
      ];

      const operators = {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between']
      };

      return {
        filters: filtersList,
        operators,
        defaultSort: 'description:asc',
        searchFields: [
          'description'
        ]
      };

    } catch (error) {
      console.error('❌ Error getting property type filters:', error);
      throw error;
    }
  }
}