import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';
import {
  GetLeasesParams,
  PaginatedLeaseResponse,
  LeaseWithRelations
} from '../types/lease';

export class LeaseService {
  static readonly FIELD_MAPPING: Record<string, { 
    type: 'direct' | 'property' | 'owner' | 'tenant' | 'type', 
    realField: string,
    relationPath?: string 
  }> = {
    'id': { type: 'direct', realField: 'id' },
    'contract_number': { type: 'direct', realField: 'contract_number' },
    'start_date': { type: 'direct', realField: 'start_date' },
    'end_date': { type: 'direct', realField: 'end_date' },
    'rent_amount': { type: 'direct', realField: 'rent_amount' },
    'condo_fee': { type: 'direct', realField: 'condo_fee' },
    'property_tax': { type: 'direct', realField: 'property_tax' },
    'extra_charges': { type: 'direct', realField: 'extra_charges' },
    'commission_amount': { type: 'direct', realField: 'commission_amount' },
    'rent_due_day': { type: 'direct', realField: 'rent_due_day' },
    'tax_due_day': { type: 'direct', realField: 'tax_due_day' },
    'condo_due_day': { type: 'direct', realField: 'condo_due_day' },
    'created_at': { type: 'direct', realField: 'created_at' },
    'updated_at': { type: 'direct', realField: 'updated_at' },
    
    // Campos de relacionamento
    'property_title': { type: 'property', realField: 'title', relationPath: 'property.title' },
    'type_description': { type: 'type', realField: 'description', relationPath: 'property.type.description' },
    'owner_name': { type: 'owner', realField: 'name', relationPath: 'owner.name' },
    'tenant_name': { type: 'tenant', realField: 'name', relationPath: 'tenant.name' },
  };

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

  // Método auxiliar para acesso seguro a propriedades aninhadas
  private static safeGetProperty<T>(obj: any, path: string): T | undefined {
    return path.split('.').reduce((acc, part) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[part];
    }, obj);
  }

  // Método auxiliar para ordenação por relacionamento em memória
  private static sortByRelatedField<T>(
    items: T[],
    sortField: string,
    direction: 'asc' | 'desc',
    fieldMapping: Record<string, { type: string; relationPath?: string }>
  ): T[] {
    return [...items].sort((a, b) => {
      const fieldInfo = fieldMapping[sortField];
      if (!fieldInfo?.relationPath) return 0;

      let valueA = '';
      let valueB = '';

      if (fieldInfo.type === 'property' || fieldInfo.type === 'owner' || 
          fieldInfo.type === 'tenant' || fieldInfo.type === 'type') {
        valueA = String(this.safeGetProperty(a, fieldInfo.relationPath) || '');
        valueB = String(this.safeGetProperty(b, fieldInfo.relationPath) || '');
      }

      const strA = this.normalizeText(valueA);
      const strB = this.normalizeText(valueB);

      if (direction === 'asc') {
        return strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' });
      } else {
        return strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
      }
    });
  }

  static async getLeases(params: GetLeasesParams = {}): Promise<PaginatedLeaseResponse> {
    try {
      console.log('🔍 Executing getLeases with params:', JSON.stringify(params, null, 2));
      
      const { 
        limit = 10, 
        page = 1, 
        search = '',
        sortOptions = {},
        includeInactive = false,
        filters = {} 
      } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      // Construir where clause sem busca global (busca será feita em memória)
      const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);
      
      // Verificar tipo de ordenação
      const sortField = Object.keys(sortOptions)[0];
      const sortDirection = sortOptions[sortField];
      
      console.log(`🔧 Campo de ordenação: ${sortField} -> ${sortDirection}`);

      let leases: LeaseWithRelations[] = [];
      let total = 0;

      // Se houver busca ou ordenação por campo relacionado, buscar todos para processar em memória
      if (search.trim() || (sortField && sortDirection && this.FIELD_MAPPING[sortField]?.type !== 'direct')) {
        console.log(`🔄 Processando em memória (busca: "${search.trim()}", ordenação relacionada: ${sortField})`);
        
        // Buscar TODOS os leases para processamento em memória
        const allLeases = await prisma.lease.findMany({
          where,
          include: {
            property: {
              select: {
                id: true,
                title: true,
                type: {
                  select: {
                    id: true,
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
            }
          }
        }) as unknown as LeaseWithRelations[];

        // Aplicar filtro de busca em memória se houver termo de busca
        let filteredLeases = allLeases;
        if (search.trim()) {
          filteredLeases = this.filterLeasesBySearch(allLeases, search);
        }

        total = filteredLeases.length;

        // Ordenar em memória se necessário
        if (sortField && sortDirection) {
          if (this.FIELD_MAPPING[sortField]?.type !== 'direct') {
            // Ordenação por campo relacionado
            leases = this.sortByRelatedField(filteredLeases, sortField, sortDirection, this.FIELD_MAPPING);
          } else {
            // Ordenação por campo direto em memória
            leases = this.sortByDirectField(filteredLeases, sortField, sortDirection);
          }
        } else {
          // Ordenação padrão por data de criação (mais recente primeiro)
          leases = filteredLeases.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        // Aplicar paginação
        leases = leases.slice(skip, skip + take);
      } else {
        // Ordenação normal (por campos diretos) sem busca global
        const orderBy = this.buildOrderBy(sortOptions);
        
        console.log('📊 ORDER BY direto:', JSON.stringify(orderBy, null, 2));
        
        // Buscar com ordenação do Prisma
        const [leasesData, totalCount] = await Promise.all([
          prisma.lease.findMany({
            where,
            skip,
            take,
            orderBy,
            include: {
              property: {
                select: {
                  id: true,
                  title: true,
                  type: {
                    select: {
                      id: true,
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
              }
            }
          }),
          prisma.lease.count({ where })
        ]);

        leases = leasesData as unknown as LeaseWithRelations[];
        total = totalCount;
      }

      console.log(`✅ Found ${leases.length} leases, total: ${total}`);

      return {
        data: leases,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in LeaseService.getLeases:', error);
      throw new Error(`Failed to fetch leases: ${error.message}`);
    }
  }

  /**
   * Filtra leases em memória com base no termo de busca (ignorando acentos)
   */
  private static filterLeasesBySearch(
    leases: LeaseWithRelations[],
    searchTerm: string
  ): LeaseWithRelations[] {
    if (!searchTerm.trim()) return leases;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return leases.filter(lease => {
      // Campos diretos do lease
      const directFields = [
        lease.contract_number,
        lease.id
      ].filter(Boolean).join(' ');

      // Campos de propriedade
      const propertyFields = [
        lease.property?.title,
        lease.property?.type?.description
      ].filter(Boolean).join(' ');

      // Campos de proprietário
      const ownerFields = [
        lease.owner?.name
      ].filter(Boolean).join(' ');

      // Campos de inquilino
      const tenantFields = [
        lease.tenant?.name
      ].filter(Boolean).join(' ');

      // Combinar todos os campos
      const allFields = [
        directFields,
        propertyFields,
        ownerFields,
        tenantFields
      ].join(' ');

      // Normalizar e verificar se contém o termo de busca
      const normalizedAllFields = this.normalizeText(allFields);
      return normalizedAllFields.includes(normalizedSearchTerm);
    });
  }

  /**
   * Ordenação por campo direto em memória
   */
  private static sortByDirectField<T>(
    items: T[],
    field: string,
    direction: 'asc' | 'desc'
  ): T[] {
    return [...items].sort((a: any, b: any) => {
      const valueA = a[field] || '';
      const valueB = b[field] || '';

      const strA = this.normalizeText(String(valueA));
      const strB = this.normalizeText(String(valueB));

      if (direction === 'asc') {
        return strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' });
      } else {
        return strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
      }
    });
  }

  /**
   * Constrói ORDER BY para campos diretos
   */
  private static buildOrderBy(sortOptions: Record<string, 'asc' | 'desc'>): any[] {
    const orderBy: any[] = [];

    Object.entries(sortOptions).forEach(([field, value]) => {
      if (!value) return;

      const direction = String(value).toLowerCase() === 'desc' ? 'desc' : 'asc';
      const realField = field.replace('sort_', '');
      
      console.log(`🔧 Processando ordenação direta: ${realField} -> ${direction}`);

      // Campos de relacionamento
      if (realField === 'property_title' || realField === 'property.title') {
        orderBy.push({ property: { title: direction } });
      } 
      else if (realField === 'type_description' || realField === 'property.type.description') {
        orderBy.push({ property: { type: { description: direction } } });
      }
      else if (realField === 'owner_name' || realField === 'owner.name') {
        orderBy.push({ owner: { name: direction } });
      }
      else if (realField === 'tenant_name' || realField === 'tenant.name') {
        orderBy.push({ tenant: { name: direction } });
      }
      // Campos diretos da locação
      else if (['id', 'contract_number', 'start_date', 'end_date', 'rent_amount', 
                'condo_fee', 'property_tax', 'extra_charges', 'commission_amount',
                'rent_due_day', 'tax_due_day', 'condo_due_day', 'created_at', 'updated_at'].includes(realField)) {
        orderBy.push({ [realField]: direction });
      }
      else {
        console.warn(`⚠️ Campo de ordenação não reconhecido: ${realField}`);
      }
    });

    if (orderBy.length === 0) {
      orderBy.push({ created_at: 'desc' });
      console.log('🔄 Usando ordenação padrão: created_at desc');
    }

    return orderBy;
  }

  /**
   * Constrói a cláusula WHERE para a query (sem busca global)
   */
  private static buildWhereClauseWithoutSearch(
    filters: Record<string, any>,
    includeInactive: boolean
  ): any {
    const where: any = {};
    
    // Filtrar por status deletado
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
        return;
      }

      console.log(`🔄 Aplicando filtro ${key}:`, value);

      // Campos diretos
      if (['contract_number', 'rent_due_day', 'tax_due_day', 'condo_due_day'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      // Campos numéricos
      else if (['rent_amount', 'condo_fee', 'property_tax', 'extra_charges', 'commission_amount'].includes(key)) {
        const floatValue = parseFloat(String(value));
        if (!isNaN(floatValue)) {
          conditions[key] = floatValue;
        }
      }
      // Campos de data
      else if (['start_date', 'end_date'].includes(key)) {
        conditions[key] = this.buildDateCondition(value);
      }
      // Campos de relacionamento
      else if (key === 'property_title') {
        if (!conditions.property) {
          conditions.property = {};
        }
        conditions.property.title = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      else if (key === 'owner_name') {
        if (!conditions.owner) {
          conditions.owner = {};
        }
        conditions.owner.name = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      else if (key === 'tenant_name') {
        if (!conditions.tenant) {
          conditions.tenant = {};
        }
        conditions.tenant.name = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      else if (key === 'type_description') {
        if (!conditions.property) {
          conditions.property = { type: {} };
        } else if (!conditions.property.type) {
          conditions.property.type = {};
        }
        conditions.property.type.description = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      // Campo de data created_at
      else if (key === 'created_at') {
        conditions.created_at = this.buildDateCondition(value);
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
              addresses: { 
                where: { deleted_at: null },
                include: { 
                  address: true 
                } 
              },
              owner: true,
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
      }) as any;

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
      
      const lease = await prisma.$transaction(async (tx: any) => {
        // Verificar se o número de contrato já existe
        if (data.contract_number) {
          const existingContract = await tx.lease.findFirst({
            where: { 
              contract_number: data.contract_number,
              deleted_at: null
            }
          });

          if (existingContract) {
            throw new Error('Contract number already registered');
          }
        }

        // Criar locação
        const newLease = await tx.lease.create({
          data: {
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
          }
        });

        return newLease;
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
      
      const lease = await prisma.$transaction(async (tx: any) => {
        // Verificar se existe e não está deletada
        const existing = await tx.lease.findUnique({ 
          where: { 
            id,
            deleted_at: null 
          } 
        });
        
        if (!existing) {
          throw new Error('Lease not found');
        }

        // Verificar se o número de contrato já existe (se mudou)
        if (data.contract_number && data.contract_number !== existing.contract_number) {
          const contractExists = await tx.lease.findFirst({
            where: { 
              contract_number: data.contract_number, 
              NOT: { id },
              deleted_at: null
            }
          });
          
          if (contractExists) {
            throw new Error('Contract number already registered for another lease');
          }
        }

        // Atualizar locação
        const updatedLease = await tx.lease.update({
          where: { id },
          data: {
            property_id: data.property_id !== undefined ? data.property_id : existing.property_id,
            type_id: data.type_id !== undefined ? data.type_id : existing.type_id,
            owner_id: data.owner_id !== undefined ? data.owner_id : existing.owner_id,
            tenant_id: data.tenant_id !== undefined ? data.tenant_id : existing.tenant_id,
            contract_number: data.contract_number !== undefined ? data.contract_number : existing.contract_number,
            start_date: data.start_date !== undefined ? new Date(data.start_date) : existing.start_date,
            end_date: data.end_date !== undefined ? new Date(data.end_date) : existing.end_date,
            rent_amount: data.rent_amount !== undefined ? Number(data.rent_amount) : existing.rent_amount,
            condo_fee: data.condo_fee !== undefined ? (data.condo_fee ? Number(data.condo_fee) : null) : existing.condo_fee,
            property_tax: data.property_tax !== undefined ? (data.property_tax ? Number(data.property_tax) : null) : existing.property_tax,
            extra_charges: data.extra_charges !== undefined ? (data.extra_charges ? Number(data.extra_charges) : null) : existing.extra_charges,
            commission_amount: data.commission_amount !== undefined ? (data.commission_amount ? Number(data.commission_amount) : null) : existing.commission_amount,
            rent_due_day: data.rent_due_day !== undefined ? Number(data.rent_due_day) : existing.rent_due_day,
            tax_due_day: data.tax_due_day !== undefined ? (data.tax_due_day ? Number(data.tax_due_day) : null) : existing.tax_due_day,
            condo_due_day: data.condo_due_day !== undefined ? (data.condo_due_day ? Number(data.condo_due_day) : null) : existing.condo_due_day,
          }
        });

        return updatedLease;
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

      // SOFT DELETE
      await prisma.lease.update({
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

      // Restaurar
      await prisma.lease.update({
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

  static async getLeaseFilters(filters?: Record<string, any>) {
    try {
      console.log('🔍 Building comprehensive lease filters with context...');
      console.log('📦 Active filters for context:', filters);

      // Construir where clause com base nos filtros atuais
      const where: any = { deleted_at: null };
      
      if (filters) {
        // Aplicar filtros atuais para contexto - USAR TEXTOS, NÃO IDs
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (key === 'contract_number') {
              where.contract_number = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
            } else if (key === 'property_title') {
              where.property = { 
                title: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode }
              };
            } else if (key === 'owner_name') {
              where.owner = { 
                name: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode }
              };
            } else if (key === 'tenant_name') {
              where.tenant = { 
                name: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode }
              };
            }
          }
        });
      }

      // Buscar dados para filtros em paralelo
      const [
        leases,
        properties,
        propertyTypes,
        owners,
        tenants,
        dateRange,
      ] = await Promise.all([
        prisma.lease.findMany({
          where,
          select: {
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
          },
        }),
        // Buscar propriedades únicas com base nas locações atuais
        prisma.property.findMany({
          where: {
            deleted_at: null,
            leases: {
              some: where
            }
          },
          select: { id: true, title: true },
          orderBy: { title: 'asc' },
          distinct: ['title']
        }),
        // Buscar tipos únicos com base nas propriedades das locações
        prisma.propertyType.findMany({
          where: {
            deleted_at: null,
            properties: {
              some: {
                deleted_at: null,
                leases: {
                  some: where
                }
              }
            }
          },
          select: { id: true, description: true },
          orderBy: { description: 'asc' },
          distinct: ['description']
        }),
        // Buscar proprietários únicos com base nas locações atuais
        prisma.owner.findMany({
          where: {
            deleted_at: null,
            leases: {
              some: where
            }
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
          distinct: ['name']
        }),
        // Buscar inquilinos únicos com base nas locações atuais
        prisma.tenant.findMany({
          where: {
            deleted_at: null,
            leases: {
              some: where
            }
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
          distinct: ['name']
        }),
        prisma.lease.aggregate({
          where,
          _min: { created_at: true },
          _max: { created_at: true }
        }),
      ]);

      // Extrair valores únicos para filtros de texto
      const uniqueContractNumbers = [...new Set(leases
        .filter(l => l.contract_number)
        .map(l => l.contract_number.trim()))].sort();
      
      const formatCurrency = (value: string): string => {
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(num);
      };

      const uniqueRentAmounts = [...new Set(leases
        .filter(l => l.rent_amount)
        .map(l => formatCurrency(l.rent_amount.toString())))]
        .sort();
      
      const uniqueRentDueDays = [...new Set(leases
        .filter(l => l.rent_due_day)
        .map(l => l.rent_due_day.toString()))]
        .sort((a, b) => parseInt(a) - parseInt(b));

      // Extrair valores para filtros de relacionamento (texto, não ID)
      const uniquePropertyTitles = [...new Set(properties
        .filter(p => p.title)
        .map(p => p.title.trim()))].sort();
      
      const uniquePropertyTypes = [...new Set(propertyTypes
        .filter(t => t.description)
        .map(t => t.description.trim()))].sort();
      
      const uniqueOwnerNames = [...new Set(owners
        .filter(o => o.name)
        .map(o => o.name.trim()))].sort();
      
      const uniqueTenantNames = [...new Set(tenants
        .filter(t => t.name)
        .map(t => t.name.trim()))].sort();

      // Construir lista de filtros - USAR VALORES DE TEXTO
      const filtersList = [
        {
          field: 'contract_number',
          type: 'string',
          label: 'Número do Contrato',
          description: 'Número do contrato de locação',
          values: uniqueContractNumbers,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'start_date',
          type: 'date',
          label: 'Data de Início',
          description: 'Data de início do contrato',
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
          values: uniqueRentAmounts,
          searchable: true
        },
        {
          field: 'condo_fee',
          type: 'number',
          label: 'Valor do Condomínio',
          description: 'Valor mensal do condomínio',
          searchable: true
        },
        {
          field: 'property_tax',
          type: 'number',
          label: 'Valor do IPTU',
          description: 'Valor mensal do IPTU',
          searchable: true
        },
        {
          field: 'extra_charges',
          type: 'number',
          label: 'Taxas Extras',
          description: 'Valor de taxas extras',
          searchable: true
        },
        {
          field: 'commission_amount',
          type: 'number',
          label: 'Comissão',
          description: 'Valor da comissão',
          searchable: true
        },
        {
          field: 'rent_due_day',
          type: 'number',
          label: 'Dia de Vencimento do Aluguel',
          description: 'Dia do mês para vencimento do aluguel',
          values: uniqueRentDueDays,
          searchable: true
        },
        {
          field: 'tax_due_day',
          type: 'number',
          label: 'Dia de Vencimento do IPTU',
          description: 'Dia do mês para vencimento do IPTU',
          searchable: true
        },
        {
          field: 'condo_due_day',
          type: 'number',
          label: 'Dia de Vencimento do Condomínio',
          description: 'Dia do mês para vencimento do condomínio',
          searchable: true
        },
        // **CORREÇÃO: Usar property_title com valores de texto**
        {
          field: 'property_title',
          type: 'string',
          label: 'Propriedade',
          description: 'Propriedade locada',
          values: uniquePropertyTitles,
          searchable: true,
          autocomplete: true
        },
        // **CORREÇÃO: Usar type_description com valores de texto**
        {
          field: 'type_description',
          type: 'string',
          label: 'Tipo de Propriedade',
          description: 'Tipo da propriedade',
          values: uniquePropertyTypes,
          searchable: true,
          autocomplete: true
        },
        // **CORREÇÃO: Usar owner_name com valores de texto**
        {
          field: 'owner_name',
          type: 'string',
          label: 'Proprietário',
          description: 'Proprietário da propriedade',
          values: uniqueOwnerNames,
          searchable: true,
          autocomplete: true
        },
        // **CORREÇÃO: Usar tenant_name com valores de texto**
        {
          field: 'tenant_name',
          type: 'string',
          label: 'Inquilino',
          description: 'Inquilino da propriedade',
          values: uniqueTenantNames,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'created_at',
          type: 'date',
          label: 'Criado em',
          description: 'Data de criação do registro',
          min: dateRange._min.created_at?.toISOString().split('T')[0],
          max: dateRange._max.created_at?.toISOString().split('T')[0],
          dateRange: true
        }
      ];

      const operators = {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        select: ['equals', 'in']
      };

      return {
        filters: filtersList,
        operators,
        defaultSort: 'created_at:desc',
        searchFields: [
          'contract_number',
          'property.title',
          'owner.name',
          'tenant.name',
          'property.type.description'
        ]
      };

    } catch (error) {
      console.error('❌ Error getting lease filters:', error);
      throw error;
    }
  }
}