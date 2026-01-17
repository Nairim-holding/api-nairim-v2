import prisma from '../lib/prisma';
import { GetPropertyTypesParams, PaginatedPropertyTypeResponse } from '../types/property-type';

export class PropertyTypeService {
  static async getPropertyTypes(params: GetPropertyTypesParams = {}): Promise<PaginatedPropertyTypeResponse> {
    try {
      console.log('🔍 Executing getPropertyTypes with params:', params);
      
      const { 
        limit = 10, 
        page = 1, 
        search = '',
        sortOptions = {},
        includeInactive = false 
      } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      // Construir where clause
      const where: any = {};
      
      // Por padrão, não mostra deletados
      if (!includeInactive) {
        where.deleted_at = null;
      }
      
      if (search) {
        const searchTerm = search.trim();
        where.OR = [
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      // Construir orderBy a partir de sortOptions
      const orderBy: any[] = [];
      
      if (sortOptions.sort_id) {
        orderBy.push({ id: sortOptions.sort_id.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_description) {
        orderBy.push({ description: sortOptions.sort_description.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }

      // Ordenação padrão se não houver sortOptions
      if (orderBy.length === 0) {
        orderBy.push({ id: 'asc' });
      }

      console.log('📊 Query parameters:', { where, skip, take, orderBy });

      // Buscar dados
      const propertyTypes = await prisma.propertyType.findMany({
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
      });

      // Contar total
      const total = await prisma.propertyType.count({ where });

      console.log(`✅ Found ${propertyTypes.length} property types, total: ${total}`);

      return {
        data: propertyTypes || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in PropertyTypeService.getPropertyTypes:', error);
      throw new Error('Failed to fetch property types');
    }
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

  static async getPropertyTypeFilters() {
    try {
      console.log('🔍 Building property type filters...');

      // Buscar todos os tipos de propriedade únicos
      const propertyTypes = await prisma.propertyType.findMany({
        select: { description: true },
        distinct: ['description'],
        where: { deleted_at: null },
        orderBy: { description: 'asc' }
      });

      // Data range para filtros de data
      const dateRange = await prisma.propertyType.aggregate({
        where: { deleted_at: null },
        _min: { created_at: true },
        _max: { created_at: true }
      });

      const filters = [
        {
          field: 'id',
          type: 'string',
          label: 'ID',
          description: 'Identificador único'
        },
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
          min: dateRange._min?.created_at?.toISOString(),
          max: dateRange._max?.created_at?.toISOString(),
          dateRange: true
        },
        {
          field: 'updated_at',
          type: 'date',
          label: 'Data de Atualização',
          description: 'Última atualização',
          dateRange: true
        }
      ];

      const operators = {
        string: ['equals', 'contains', 'startsWith', 'endsWith', 'in', 'not'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between']
      };

      return {
        filters: filters.filter(f => !f.values || f.values.length > 0),
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