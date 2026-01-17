import { PropertyStatus } from '@/generated/prisma/enums';
import prisma from '../lib/prisma';
import { GetPropertiesParams, PaginatedPropertyResponse } from '../types/property';
import { Prisma } from '@/generated/prisma/client';

export class PropertyService {
  static async getProperties(params: GetPropertiesParams = {}): Promise<PaginatedPropertyResponse> {
    try {
      console.log('🔍 Executing getProperties with params:', params);
      
      const { 
        limit = 10, 
        page = 1, 
        search = '',
        filters = {},
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
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { tax_registration: { contains: searchTerm, mode: 'insensitive' } },
          { notes: { contains: searchTerm, mode: 'insensitive' } },
          { owner: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { type: { description: { contains: searchTerm, mode: 'insensitive' } } },
          { agency: { trade_name: { contains: searchTerm, mode: 'insensitive' } } },
        ];
      }

      // Aplicar filtros
      const andFilters: any[] = [];
      
      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;

        switch (key) {
          case 'city':
            andFilters.push({ 
              addresses: { 
                some: { 
                  address: { 
                    city: { contains: value, mode: 'insensitive' } 
                  } 
                } 
              } 
            });
            break;
          case 'state':
            andFilters.push({ 
              addresses: { 
                some: { 
                  address: { 
                    state: { equals: value, mode: 'insensitive' } 
                  } 
                } 
              } 
            });
            break;
          case 'type_id':
            andFilters.push({ type_id: value });
            break;
          case 'owner_id':
            andFilters.push({ owner_id: value });
            break;
          case 'agency_id':
            andFilters.push({ agency_id: value });
            break;
          case 'furnished':
            andFilters.push({ furnished: value === 'true' });
            break;
          case 'bedrooms':
          case 'bathrooms':
          case 'half_bathrooms':
          case 'garage_spaces':
          case 'floor_number':
            andFilters.push({ [key]: parseInt(value) });
            break;
          case 'area_total':
          case 'area_built':
          case 'frontage':
            andFilters.push({ [key]: parseFloat(value) });
            break;
          default:
            // Para campos de texto genéricos
            andFilters.push({ [key]: { contains: value, mode: 'insensitive' } });
            break;
        }
      });

      if (andFilters.length > 0) {
        where.AND = [...(where.AND || []), ...andFilters];
      }

      // Construir orderBy
      const orderBy: any[] = [];

      Object.entries(sortOptions).forEach(([key, value]) => {
        if (!value) return;

        const direction = value.toLowerCase() === 'desc' ? 'desc' : 'asc';
        const field = key.replace('sort_', '');

        switch (field) {
          case 'owner':
            orderBy.push({ owner: { name: direction } });
            break;
          case 'type':
            orderBy.push({ type: { description: direction } });
            break;
          case 'agency':
            orderBy.push({ agency: { trade_name: direction } });
            break;
          default:
            if (field in Prisma.PropertyScalarFieldEnum) {
              orderBy.push({ [field]: direction });
            }
            break;
        }
      });

      if (orderBy.length === 0) {
        orderBy.push({ id: 'asc' });
      }

      console.log('📊 Query parameters:', { where, skip, take, orderBy });

      // Buscar dados
      const properties = await prisma.property.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          addresses: {
            where: { deleted_at: null },
            include: { address: true }
          },
          owner: true,
          type: true,
          documents: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' }
          },
          values: {
            where: { deleted_at: null },
            orderBy: { reference_date: 'desc' }
          },
          agency: true,
          leases: {
            where: { deleted_at: null },
            take: 1,
            orderBy: { created_at: 'desc' }
          }
        }
      }) as any;

      // Contar total
      const total = await prisma.property.count({ where });

      console.log(`✅ Found ${properties.length} properties, total: ${total}`);

      return {
        data: properties || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in PropertyService.getProperties:', error);
      throw new Error('Failed to fetch properties');
    }
  }

  static async getPropertyById(id: string) {
    try {
      console.log(`🔍 Getting property by ID: ${id}`);
      
      const property = await prisma.property.findUnique({
        where: { 
          id,
          deleted_at: null
        },
        include: {
          addresses: {
            where: { deleted_at: null },
            include: { address: true }
          },
          owner: true,
          type: true,
          documents: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' }
          },
          values: {
            where: { deleted_at: null },
            orderBy: { reference_date: 'desc' }
          },
          agency: true,
          leases: {
            where: { deleted_at: null },
            include: {
              tenant: true,
              owner: true
            }
          },
          favorites: {
            where: { deleted_at: null },
            include: { user: true }
          }
        }
      });

      if (!property) {
        throw new Error('Property not found');
      }

      console.log(`✅ Found property: ${property.title}`);
      return property;

    } catch (error: any) {
      console.error(`❌ Error getting property ${id}:`, error);
      throw error;
    }
  }

  static async createProperty(data: any) {
    try {
      console.log('➕ Creating new property:', data.title);
      
      const property = await prisma.$transaction(async (tx: any) => {
        // Verificar se o proprietário existe
        const owner = await tx.owner.findUnique({
          where: { 
            id: data.owner_id,
            deleted_at: null
          }
        });

        if (!owner) {
          throw new Error('Owner not found');
        }

        // Verificar se o tipo de propriedade existe
        const propertyType = await tx.propertyType.findUnique({
          where: { 
            id: data.type_id,
            deleted_at: null
          }
        });

        if (!propertyType) {
          throw new Error('Property type not found');
        }

        // Verificar se a agência existe (se fornecida)
        if (data.agency_id) {
          const agency = await tx.agency.findUnique({
            where: { 
              id: data.agency_id,
              deleted_at: null
            }
          });

          if (!agency) {
            throw new Error('Agency not found');
          }
        }

        // Criar propriedade
        const newProperty = await tx.property.create({
          data: {
            title: data.title,
            bedrooms: parseInt(data.bedrooms),
            bathrooms: parseInt(data.bathrooms),
            half_bathrooms: parseInt(data.half_bathrooms || 0),
            garage_spaces: parseInt(data.garage_spaces || 0),
            area_total: parseFloat(data.area_total),
            area_built: parseFloat(data.area_built || 0),
            frontage: parseFloat(data.frontage || 0),
            furnished: Boolean(data.furnished),
            floor_number: parseInt(data.floor_number || 0),
            tax_registration: data.tax_registration,
            notes: data.notes,
            owner_id: data.owner_id,
            type_id: data.type_id,
            agency_id: data.agency_id || null,
          }
        });

        // Adicionar endereço
        if (data.address) {
          const newAddress = await tx.address.create({
            data: {
              zip_code: data.address.zip_code,
              street: data.address.street,
              number: data.address.number,
              district: data.address.district,
              city: data.address.city,
              state: data.address.state,
              country: data.address.country || 'Brasil',
            }
          });

          await tx.propertyAddress.create({
            data: {
              property_id: newProperty.id,
              address_id: newAddress.id
            }
          });
        }

        // Adicionar valores da propriedade
        if (data.values) {
          await tx.propertyValue.create({
            data: {
              property_id: newProperty.id,
              purchase_value: parseFloat(data.values.purchase_value),
              rental_value: parseFloat(data.values.rental_value),
              condo_fee: parseFloat(data.values.condo_fee || 0),
              property_tax: parseFloat(data.values.property_tax || 0),
              status: data.values.status as PropertyStatus || 'AVAILABLE',
              notes: data.values.notes,
              reference_date: new Date(data.values.reference_date || new Date()),
            }
          });
        }

        return newProperty;
      });

      console.log(`✅ Property created: ${property.id}`);
      return property;

    } catch (error: any) {
      console.error('❌ Error creating property:', error);
      throw error;
    }
  }

  static async updateProperty(id: string, data: any) {
    try {
      console.log(`✏️ Updating property: ${id}`);
      
      const property = await prisma.$transaction(async (tx: any) => {
        // Verificar se existe e não está deletada
        const existing = await tx.property.findUnique({ 
          where: { 
            id,
            deleted_at: null 
          } 
        });
        
        if (!existing) {
          throw new Error('Property not found');
        }

        // Verificar relacionamentos se forem fornecidos
        if (data.owner_id && data.owner_id !== existing.owner_id) {
          const owner = await tx.owner.findUnique({
            where: { 
              id: data.owner_id,
              deleted_at: null
            }
          });

          if (!owner) {
            throw new Error('Owner not found');
          }
        }

        if (data.type_id && data.type_id !== existing.type_id) {
          const propertyType = await tx.propertyType.findUnique({
            where: { 
              id: data.type_id,
              deleted_at: null
            }
          });

          if (!propertyType) {
            throw new Error('Property type not found');
          }
        }

        if (data.agency_id !== undefined && data.agency_id !== existing.agency_id) {
          if (data.agency_id) {
            const agency = await tx.agency.findUnique({
              where: { 
                id: data.agency_id,
                deleted_at: null
              }
            });

            if (!agency) {
              throw new Error('Agency not found');
            }
          }
        }

        // Preparar dados para atualização
        const updateData: any = {};

        if (data.title !== undefined) updateData.title = data.title;
        if (data.bedrooms !== undefined) updateData.bedrooms = parseInt(data.bedrooms);
        if (data.bathrooms !== undefined) updateData.bathrooms = parseInt(data.bathrooms);
        if (data.half_bathrooms !== undefined) updateData.half_bathrooms = parseInt(data.half_bathrooms);
        if (data.garage_spaces !== undefined) updateData.garage_spaces = parseInt(data.garage_spaces);
        if (data.area_total !== undefined) updateData.area_total = parseFloat(data.area_total);
        if (data.area_built !== undefined) updateData.area_built = parseFloat(data.area_built);
        if (data.frontage !== undefined) updateData.frontage = parseFloat(data.frontage);
        if (data.furnished !== undefined) updateData.furnished = Boolean(data.furnished);
        if (data.floor_number !== undefined) updateData.floor_number = parseInt(data.floor_number);
        if (data.tax_registration !== undefined) updateData.tax_registration = data.tax_registration;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.owner_id !== undefined) updateData.owner_id = data.owner_id;
        if (data.type_id !== undefined) updateData.type_id = data.type_id;
        if (data.agency_id !== undefined) updateData.agency_id = data.agency_id || null;

        // Atualizar propriedade
        const updatedProperty = await tx.property.update({
          where: { id },
          data: updateData
        });

        // Atualizar endereço (substituir)
        if (data.address !== undefined) {
          // Soft delete do endereço existente
          await tx.propertyAddress.updateMany({
            where: { 
              property_id: id,
              deleted_at: null 
            },
            data: { deleted_at: new Date() }
          });

          // Adicionar novo endereço se fornecido
          if (data.address) {
            const newAddress = await tx.address.create({
              data: {
                zip_code: data.address.zip_code,
                street: data.address.street,
                number: data.address.number,
                district: data.address.district,
                city: data.address.city,
                state: data.address.state,
                country: data.address.country || 'Brasil',
              }
            });

            await tx.propertyAddress.create({
              data: {
                property_id: id,
                address_id: newAddress.id
              }
            });
          }
        }

        // Atualizar valores da propriedade (adicionar novo registro histórico)
        if (data.values !== undefined && data.values) {
          await tx.propertyValue.create({
            data: {
              property_id: id,
              purchase_value: parseFloat(data.values.purchase_value || 0),
              rental_value: parseFloat(data.values.rental_value || 0),
              condo_fee: parseFloat(data.values.condo_fee || 0),
              property_tax: parseFloat(data.values.property_tax || 0),
              status: data.values.status as PropertyStatus || 'AVAILABLE',
              notes: data.values.notes,
              reference_date: new Date(data.values.reference_date || new Date()),
            }
          });
        }

        return updatedProperty;
      });

      console.log(`✅ Property updated: ${property.id}`);
      return property;

    } catch (error: any) {
      console.error(`❌ Error updating property ${id}:`, error);
      throw error;
    }
  }

  static async deleteProperty(id: string) {
    try {
      console.log(`🗑️ Soft deleting property: ${id}`);
      
      // Verificar se a propriedade existe e não está deletada
      const property = await prisma.property.findUnique({
        where: { 
          id,
          deleted_at: null
        },
      });

      if (!property) {
        throw new Error('Property not found or already deleted');
      }

      // SOFT DELETE em cascata
      await prisma.$transaction(async (tx: any) => {
        // Soft delete da propriedade
        await tx.property.update({
          where: { id },
          data: { 
            deleted_at: new Date(),
          },
        });

        // Soft delete dos documentos relacionados
        await tx.document.updateMany({
          where: { 
            property_id: id,
            deleted_at: null 
          },
          data: { deleted_at: new Date() }
        });

        // Soft delete dos endereços relacionados
        await tx.propertyAddress.updateMany({
          where: { 
            property_id: id,
            deleted_at: null 
          },
          data: { deleted_at: new Date() }
        });

        // Soft delete dos favoritos relacionados
        await tx.favorite.updateMany({
          where: { 
            property_id: id,
            deleted_at: null 
          },
          data: { deleted_at: new Date() }
        });

        // Soft delete dos leases relacionados
        await tx.lease.updateMany({
          where: { 
            property_id: id,
            deleted_at: null 
          },
          data: { deleted_at: new Date() }
        });

        // Soft delete dos valores relacionados
        await tx.propertyValue.updateMany({
          where: { 
            property_id: id,
            deleted_at: null 
          },
          data: { deleted_at: new Date() }
        });
      });

      console.log(`✅ Property soft deleted: ${id}`);
      return property;

    } catch (error: any) {
      console.error(`❌ Error soft deleting property ${id}:`, error);
      throw error;
    }
  }

  static async restoreProperty(id: string) {
    try {
      console.log(`♻️ Restoring property: ${id}`);
      
      // Verificar se a propriedade existe
      const property = await prisma.property.findUnique({
        where: { id },
      });

      if (!property) {
        throw new Error('Property not found');
      }

      if (!property.deleted_at) {
        throw new Error('Property is not deleted');
      }

      // Restaurar em cascata
      await prisma.$transaction(async (tx: any) => {
        // Restaurar propriedade
        await tx.property.update({
          where: { id },
          data: { 
            deleted_at: null,
          },
        });

        // Restaurar documentos relacionados
        await tx.document.updateMany({
          where: { property_id: id },
          data: { deleted_at: null }
        });

        // Restaurar endereços relacionados
        await tx.propertyAddress.updateMany({
          where: { property_id: id },
          data: { deleted_at: null }
        });

        // Restaurar favoritos relacionados
        await tx.favorite.updateMany({
          where: { property_id: id },
          data: { deleted_at: null }
        });

        // Restaurar leases relacionados
        await tx.lease.updateMany({
          where: { property_id: id },
          data: { deleted_at: null }
        });

        // Restaurar valores relacionados
        await tx.propertyValue.updateMany({
          where: { property_id: id },
          data: { deleted_at: null }
        });
      });
      
      console.log(`✅ Property restored: ${id}`);
      return property;

    } catch (error: any) {
      console.error(`❌ Error restoring property ${id}:`, error);
      throw error;
    }
  }

  static async getPropertyFilters() {
    try {
      console.log('🔍 Building comprehensive property filters...');

      // Buscar todos os campos únicos para filtros
      const [
        titles,
        propertyTypes,
        owners,
        agencies,
        cities,
        states,
        furnishedStatus,
        bedrooms,
        bathrooms,
        dateRange
      ] = await Promise.all([
        // Títulos das propriedades
        prisma.property.findMany({
          select: { title: true },
          distinct: ['title'],
          where: { deleted_at: null },
          orderBy: { title: 'asc' }
        }),
        // Tipos de propriedade
        prisma.propertyType.findMany({
          select: { id: true, description: true },
          where: { deleted_at: null },
          orderBy: { description: 'asc' }
        }),
        // Proprietários
        prisma.owner.findMany({
          select: { id: true, name: true },
          where: { deleted_at: null },
          orderBy: { name: 'asc' }
        }),
        // Agências
        prisma.agency.findMany({
          select: { id: true, trade_name: true },
          where: { deleted_at: null },
          orderBy: { trade_name: 'asc' }
        }),
        // Cidades
        prisma.address.findMany({
          select: { city: true },
          distinct: ['city'],
          where: { 
            city: { not: undefined },
            deleted_at: null,
            propertyAddresses: {
              some: {
                property: {
                  deleted_at: null
                }
              }
            }
          },
          orderBy: { city: 'asc' }
        }),
        // Estados
        prisma.address.findMany({
          select: { state: true },
          distinct: ['state'],
          where: { 
            state: { not: undefined },
            deleted_at: null,
            propertyAddresses: {
              some: {
                property: {
                  deleted_at: null
                }
              }
            }
          },
          orderBy: { state: 'asc' }
        }),
        // Status de mobiliado
        prisma.property.findMany({
          select: { furnished: true },
          distinct: ['furnished'],
          where: { deleted_at: null }
        }),
        // Quartos
        prisma.property.findMany({
          select: { bedrooms: true },
          distinct: ['bedrooms'],
          where: { deleted_at: null },
          orderBy: { bedrooms: 'asc' }
        }),
        // Banheiros
        prisma.property.findMany({
          select: { bathrooms: true },
          distinct: ['bathrooms'],
          where: { deleted_at: null },
          orderBy: { bathrooms: 'asc' }
        }),
        // Data range
        prisma.property.aggregate({
          where: { deleted_at: null },
          _min: { created_at: true },
          _max: { created_at: true }
        })
      ]);

      const filters = [
        {
          field: 'id',
          type: 'string',
          label: 'ID',
          description: 'Identificador único'
        },
        {
          field: 'title',
          type: 'string',
          label: 'Título',
          description: 'Título da propriedade',
          values: titles
            .filter(p => p.title)
            .map(p => p.title.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'type_id',
          type: 'select',
          label: 'Tipo de Propriedade',
          description: 'Tipo da propriedade',
          options: propertyTypes.map(pt => ({ value: pt.id, label: pt.description })),
          searchable: true
        },
        {
          field: 'owner_id',
          type: 'select',
          label: 'Proprietário',
          description: 'Proprietário da propriedade',
          options: owners.map(o => ({ value: o.id, label: o.name })),
          searchable: true
        },
        {
          field: 'agency_id',
          type: 'select',
          label: 'Agência',
          description: 'Agência responsável',
          options: agencies.map(a => ({ value: a.id, label: a.trade_name })),
          searchable: true
        },
        {
          field: 'bedrooms',
          type: 'number',
          label: 'Quartos',
          description: 'Número de quartos',
          values: bedrooms
            .filter(p => p.bedrooms !== null)
            .map(p => p.bedrooms.toString()),
          searchable: true
        },
        {
          field: 'bathrooms',
          type: 'number',
          label: 'Banheiros',
          description: 'Número de banheiros',
          values: bathrooms
            .filter(p => p.bathrooms !== null)
            .map(p => p.bathrooms.toString()),
          searchable: true
        },
        {
          field: 'furnished',
          type: 'boolean',
          label: 'Mobiliado',
          description: 'Propriedade mobiliada',
          values: furnishedStatus.map(f => f.furnished.toString()),
          options: ['true', 'false']
        },
        {
          field: 'area_total',
          type: 'number',
          label: 'Área Total',
          description: 'Área total em m²',
          searchable: true
        },
        {
          field: 'area_built',
          type: 'number',
          label: 'Área Construída',
          description: 'Área construída em m²',
          searchable: true
        },
        {
          field: 'address.city',
          type: 'string',
          label: 'Cidade',
          description: 'Cidade da propriedade',
          values: cities
            .filter(a => a.city)
            .map(a => a.city.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'address.state',
          type: 'string',
          label: 'Estado',
          description: 'Estado da propriedade',
          values: states
            .filter(a => a.state)
            .map(a => a.state.trim()),
          searchable: true,
          autocomplete: true,
          options: [
            'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
            'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
            'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
          ]
        },
        {
          field: 'created_at',
          type: 'date',
          label: 'Data de Criação',
          description: 'Data de cadastro no sistema',
          min: dateRange._min?.created_at?.toISOString(),
          max: dateRange._max?.created_at?.toISOString(),
          dateRange: true
        }
      ];

      const operators = {
        string: ['equals', 'contains', 'startsWith', 'endsWith', 'in', 'not'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between', 'not'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        select: ['equals', 'in', 'not']
      };

      return {
        filters: filters.filter(f => !f.values || f.values.length > 0),
        operators,
        defaultSort: 'created_at:desc',
        searchFields: [
          'title',
          'tax_registration',
          'owner.name',
          'type.description',
          'address.city',
          'address.state'
        ]
      };

    } catch (error) {
      console.error('❌ Error getting comprehensive property filters:', error);
      throw error;
    }
  }
}