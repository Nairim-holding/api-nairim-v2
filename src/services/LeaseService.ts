import prisma from '../lib/prisma';
import { GetLeasesParams, Lease, PaginatedLeaseResponse } from '../types/lease';

export class LeaseService {
  static async getLeases(params: GetLeasesParams = {}): Promise<PaginatedLeaseResponse> {
    try {
      console.log('🔍 Executing getLeases with params:', params);
      
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
      const where: any = includeInactive ? {} : { deleted_at: null };

      if (search) {
        const searchTerm = search.trim().toUpperCase();
        
        where.OR = [
          { owner: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { tenant: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { property: { title: { contains: searchTerm, mode: 'insensitive' } } },
          { contract_number: { contains: searchTerm, mode: 'insensitive' } }
        ];
      }

      // Construir orderBy
      const orderBy: any[] = [];

      // Mapear sortOptions para orderBy do Prisma
      if (sortOptions.sort_id) {
        orderBy.push({ id: sortOptions.sort_id.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_contract_number) {
        orderBy.push({ contract_number: sortOptions.sort_contract_number.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_start_date) {
        orderBy.push({ start_date: sortOptions.sort_start_date.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_end_date) {
        orderBy.push({ end_date: sortOptions.sort_end_date.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_rent_amount) {
        orderBy.push({ rent_amount: sortOptions.sort_rent_amount.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_condominium_fee) {
        orderBy.push({ condo_fee: sortOptions.sort_condominium_fee.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_iptu) {
        orderBy.push({ property_tax: sortOptions.sort_iptu.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_extra_fees) {
        orderBy.push({ extra_charges: sortOptions.sort_extra_fees.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_commission_value) {
        orderBy.push({ commission_amount: sortOptions.sort_commission_value.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_rent_due_day) {
        orderBy.push({ rent_due_day: sortOptions.sort_rent_due_day.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_tax_due_day) {
        orderBy.push({ tax_due_day: sortOptions.sort_tax_due_day.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_condo_due_day) {
        orderBy.push({ condo_due_day: sortOptions.sort_condo_due_day.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_property) {
        orderBy.push({ 
          property: { 
            title: sortOptions.sort_property.toLowerCase() === 'desc' ? 'desc' : 'asc' 
          } 
        });
      }
      if (sortOptions.sort_type) {
        orderBy.push({ 
          property: { 
            type: { 
              description: sortOptions.sort_type.toLowerCase() === 'desc' ? 'desc' : 'asc' 
            } 
          } 
        });
      }
      if (sortOptions.sort_owner) {
        orderBy.push({ 
          owner: { 
            name: sortOptions.sort_owner.toLowerCase() === 'desc' ? 'desc' : 'asc' 
          } 
        });
      }
      if (sortOptions.sort_tenant) {
        orderBy.push({ 
          tenant: { 
            name: sortOptions.sort_tenant.toLowerCase() === 'desc' ? 'desc' : 'asc' 
          } 
        });
      }

      // Ordenação padrão
      if (orderBy.length === 0) {
        orderBy.push({ id: 'asc' });
      }

      console.log('📊 Query parameters:', { where, skip, take, orderBy });

      // Buscar dados
      const leases = await prisma.lease.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          contract_number: true,
          start_date: true,
          end_date: true,
          rent_amount: true,
          condo_fee: true,
          property_tax: true,
          extra_charges: true,
          commission_amount: true,
          rent_due_day: true,
          tax_due_day: true,
          condo_due_day: true,
          property: { 
            select: { 
              id: true, 
              title: true, 
              type: { 
                select: { 
                  description: true 
                } 
              } 
            } 
          },
          owner: { 
            select: { 
              id: true, 
              name: true 
            } 
          },
          tenant: { 
            select: { 
              id: true, 
              name: true 
            } 
          },
          created_at: true,
          updated_at: true,
          deleted_at: true,
        },
      });

      // Contar total
      const total = await prisma.lease.count({ where });

      console.log(`✅ Found ${leases.length} leases, total: ${total}`);

      return {
        data: leases as unknown as Lease[] || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in LeaseService.getLeases:', error);
      throw new Error('Failed to fetch leases');
    }
  }

  static async getLeaseById(id: string) {
    try {
      console.log(`🔍 Getting lease by ID: ${id}`);
      
      const lease = await prisma.lease.findUnique({
        where: { 
          id,
          deleted_at: null
        },
        include: {
          property: {
            include: {
              type: true,
              documents: {
                where: { deleted_at: null }
              },
              addresses: { 
                where: { deleted_at: null },
                include: { 
                  address: true 
                } 
              },
              owner: true,
              values: {
                where: { deleted_at: null }
              },
            }
          },
          owner: {
            include: {
              addresses: { 
                where: { deleted_at: null },
                include: { 
                  address: true 
                } 
              },
              contacts: { 
                where: { deleted_at: null },
                include: { 
                  contact: true 
                } 
              }
            }
          },
          tenant: {
            include: {
              addresses: { 
                where: { deleted_at: null },
                include: { 
                  address: true 
                } 
              },
              contacts: { 
                where: { deleted_at: null },
                include: { 
                  contact: true 
                } 
              }
            }
          },
          type: true
        }
      });

      if (!lease) {
        throw new Error('Lease not found');
      }

      console.log(`✅ Found lease: ${lease.contract_number}`);
      return lease;

    } catch (error: any) {
      console.error(`❌ Error getting lease ${id}:`, error);
      throw error;
    }
  }

  static async createLease(data: any) {
    try {
      console.log('➕ Creating new lease:', data.contract_number);
      
      const leaseData = {
        property_id: data.property_id,
        type_id: data.type_id,
        owner_id: data.owner_id,
        tenant_id: data.tenant_id,
        contract_number: data.contract_number,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        rent_amount: Number(data.rent_amount),
        condo_fee: data.condo_fee ? Number(data.condo_fee) : null,
        property_tax: data.property_tax ? Number(data.property_tax) : null,
        extra_charges: data.extra_charges ? Number(data.extra_charges) : null,
        commission_amount: data.commission_amount ? Number(data.commission_amount) : null,
        rent_due_day: Number(data.rent_due_day),
        tax_due_day: data.tax_due_day ? Number(data.tax_due_day) : null,
        condo_due_day: data.condo_due_day ? Number(data.condo_due_day) : null,
      };

      const lease = await prisma.lease.create({
        data: leaseData,
      });

      console.log(`✅ Lease created: ${lease.id}`);
      return lease;

    } catch (error: any) {
      console.error('❌ Error creating lease:', error);
      throw error;
    }
  }

  static async updateLease(id: string, data: any) {
    try {
      console.log(`✏️ Updating lease: ${id}`);
      
      // Verificar se existe e não está deletada
      const existing = await prisma.lease.findUnique({ 
        where: { 
          id,
          deleted_at: null 
        } 
      });
      
      if (!existing) {
        throw new Error('Lease not found');
      }

      const updateData: any = {};
      
      if (data.property_id !== undefined) updateData.property_id = data.property_id;
      if (data.type_id !== undefined) updateData.type_id = data.type_id;
      if (data.owner_id !== undefined) updateData.owner_id = data.owner_id;
      if (data.tenant_id !== undefined) updateData.tenant_id = data.tenant_id;
      if (data.contract_number !== undefined) updateData.contract_number = data.contract_number;
      if (data.start_date !== undefined) updateData.start_date = new Date(data.start_date);
      if (data.end_date !== undefined) updateData.end_date = new Date(data.end_date);
      if (data.rent_amount !== undefined) updateData.rent_amount = Number(data.rent_amount);
      if (data.condo_fee !== undefined) updateData.condo_fee = data.condo_fee ? Number(data.condo_fee) : null;
      if (data.property_tax !== undefined) updateData.property_tax = data.property_tax ? Number(data.property_tax) : null;
      if (data.extra_charges !== undefined) updateData.extra_charges = data.extra_charges ? Number(data.extra_charges) : null;
      if (data.commission_amount !== undefined) updateData.commission_amount = data.commission_amount ? Number(data.commission_amount) : null;
      if (data.rent_due_day !== undefined) updateData.rent_due_day = Number(data.rent_due_day);
      if (data.tax_due_day !== undefined) updateData.tax_due_day = data.tax_due_day ? Number(data.tax_due_day) : null;
      if (data.condo_due_day !== undefined) updateData.condo_due_day = data.condo_due_day ? Number(data.condo_due_day) : null;

      const lease = await prisma.lease.update({
        where: { id },
        data: updateData,
      });

      console.log(`✅ Lease updated: ${lease.id}`);
      return lease;

    } catch (error: any) {
      console.error(`❌ Error updating lease ${id}:`, error);
      throw error;
    }
  }

  static async deleteLease(id: string) {
    try {
      console.log(`🗑️ Soft deleting lease: ${id}`);
      
      // Verificar se a locação existe e não está deletada
      const lease = await prisma.lease.findUnique({
        where: { 
          id,
          deleted_at: null
        },
      });

      if (!lease) {
        throw new Error('Lease not found or already deleted');
      }

      // SOFT DELETE: atualizar o campo deleted_at
      const deletedLease = await prisma.lease.update({
        where: { id },
        data: { 
          deleted_at: new Date(),
        },
      });

      console.log(`✅ Lease soft deleted: ${id}`);
      return lease;

    } catch (error: any) {
      console.error(`❌ Error soft deleting lease ${id}:`, error);
      throw error;
    }
  }

  static async restoreLease(id: string) {
    try {
      console.log(`♻️ Restoring lease: ${id}`);
      
      // Verificar se a locação existe
      const lease = await prisma.lease.findUnique({
        where: { id },
      });

      if (!lease) {
        throw new Error('Lease not found');
      }

      if (!lease.deleted_at) {
        throw new Error('Lease is not deleted');
      }

      // Restaurar: setar deleted_at para null
      const restoredLease = await prisma.lease.update({
        where: { id },
        data: { 
          deleted_at: null,
        }
      });
      
      console.log(`✅ Lease restored: ${id}`);
      return lease;

    } catch (error: any) {
      console.error(`❌ Error restoring lease ${id}:`, error);
      throw error;
    }
  }

  static async getLeaseFilters() {
    try {
      console.log('🔍 Building comprehensive lease filters...');

      // Buscar todos os campos únicos para filtros
      const [
        contractNumbers,
        propertyTitles,
        propertyTypes,
        ownerNames,
        tenantNames,
        dateRange
      ] = await Promise.all([
        // Números de contrato
        prisma.lease.findMany({
          select: { contract_number: true },
          distinct: ['contract_number'],
          where: { deleted_at: null },
          orderBy: { contract_number: 'asc' }
        }),
        // Títulos das propriedades
        prisma.lease.findMany({
          select: { property: { select: { title: true } } },
          distinct: ['property_id'],
          where: { deleted_at: null },
          orderBy: { property: { title: 'asc' } }
        }),
        // Tipos de propriedade
        prisma.lease.findMany({
          select: { property: { select: { type: { select: { description: true } } } } },
          distinct: ['type_id'],
          where: { deleted_at: null },
          orderBy: { property: { type: { description: 'asc' } } }
        }),
        // Nomes dos proprietários
        prisma.lease.findMany({
          select: { owner: { select: { name: true } } },
          distinct: ['owner_id'],
          where: { deleted_at: null },
          orderBy: { owner: { name: 'asc' } }
        }),
        // Nomes dos inquilinos
        prisma.lease.findMany({
          select: { tenant: { select: { name: true } } },
          distinct: ['tenant_id'],
          where: { deleted_at: null },
          orderBy: { tenant: { name: 'asc' } }
        }),
        // Data range
        prisma.lease.aggregate({
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
          field: 'contract_number',
          type: 'string',
          label: 'Número do Contrato',
          description: 'Número do contrato de locação',
          values: contractNumbers
            .filter(l => l.contract_number)
            .map(l => l.contract_number),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'start_date',
          type: 'date',
          label: 'Data de Início',
          description: 'Data de início do contrato',
          min: dateRange._min?.created_at?.toISOString(),
          max: dateRange._max?.created_at?.toISOString(),
          dateRange: true
        },
        {
          field: 'end_date',
          type: 'date',
          label: 'Data de Término',
          description: 'Data de término do contrato',
          dateRange: true
        },
        {
          field: 'rent_amount',
          type: 'number',
          label: 'Valor do Aluguel',
          description: 'Valor mensal do aluguel',
          searchable: true
        },
        {
          field: 'property.title',
          type: 'string',
          label: 'Propriedade',
          description: 'Título da propriedade',
          values: propertyTitles
            .filter(l => l.property?.title)
            .map(l => l.property.title),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'property.type.description',
          type: 'string',
          label: 'Tipo de Propriedade',
          description: 'Tipo da propriedade',
          values: propertyTypes
            .filter(l => l.property?.type?.description)
            .map(l => l.property.type.description),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'owner.name',
          type: 'string',
          label: 'Proprietário',
          description: 'Nome do proprietário',
          values: ownerNames
            .filter(l => l.owner?.name)
            .map(l => l.owner.name),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'tenant.name',
          type: 'string',
          label: 'Inquilino',
          description: 'Nome do inquilino',
          values: tenantNames
            .filter(l => l.tenant?.name)
            .map(l => l.tenant.name),
          searchable: true,
          autocomplete: true
        }
      ];

      const operators = {
        string: ['equals', 'contains', 'startsWith', 'endsWith', 'in', 'not'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between', 'not'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals']
      };

      return {
        filters: filters.filter(f => !f.values || f.values.length > 0),
        operators,
        defaultSort: 'created_at:desc',
        searchFields: [
          'contract_number',
          'property.title',
          'owner.name',
          'tenant.name'
        ]
      };

    } catch (error) {
      console.error('❌ Error getting comprehensive lease filters:', error);
      throw error;
    }
  }
}