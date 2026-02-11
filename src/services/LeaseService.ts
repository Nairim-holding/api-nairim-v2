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
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ñÑ]/g, 'n')
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

      const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);
      const sortField = Object.keys(sortOptions)[0];
      const sortDirection = sortOptions[sortField];
      
      let leases: LeaseWithRelations[] = [];
      let total = 0;

      if (search.trim() || (sortField && sortDirection && this.FIELD_MAPPING[sortField]?.type !== 'direct')) {
        const allLeases = await prisma.lease.findMany({
          where,
          include: {
            property: {
              select: {
                id: true,
                title: true,
                type: { select: { id: true, description: true } }
              }
            },
            owner: { select: { id: true, name: true } },
            tenant: { select: { id: true, name: true } }
          }
        }) as unknown as LeaseWithRelations[];

        let filteredLeases = allLeases;
        if (search.trim()) {
          filteredLeases = this.filterLeasesBySearch(allLeases, search);
        }

        total = filteredLeases.length;

        if (sortField && sortDirection) {
          if (this.FIELD_MAPPING[sortField]?.type !== 'direct') {
            leases = this.sortByRelatedField(filteredLeases, sortField, sortDirection, this.FIELD_MAPPING);
          } else {
            leases = this.sortByDirectField(filteredLeases, sortField, sortDirection);
          }
        } else {
          leases = filteredLeases.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        leases = leases.slice(skip, skip + take);
      } else {
        const orderBy = this.buildOrderBy(sortOptions);
        
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
                  type: { select: { id: true, description: true } }
                }
              },
              owner: { select: { id: true, name: true } },
              tenant: { select: { id: true, name: true } }
            }
          }),
          prisma.lease.count({ where })
        ]);

        leases = leasesData as unknown as LeaseWithRelations[];
        total = totalCount;
      }

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

  private static filterLeasesBySearch(
    leases: LeaseWithRelations[],
    searchTerm: string
  ): LeaseWithRelations[] {
    if (!searchTerm.trim()) return leases;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return leases.filter(lease => {
      const directFields = [lease.contract_number, lease.id].filter(Boolean).join(' ');
      const propertyFields = [lease.property?.title, lease.property?.type?.description].filter(Boolean).join(' ');
      const ownerFields = [lease.owner?.name].filter(Boolean).join(' ');
      const tenantFields = [lease.tenant?.name].filter(Boolean).join(' ');

      const allFields = [directFields, propertyFields, ownerFields, tenantFields].join(' ');
      const normalizedAllFields = this.normalizeText(allFields);
      return normalizedAllFields.includes(normalizedSearchTerm);
    });
  }

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

  private static buildOrderBy(sortOptions: Record<string, 'asc' | 'desc'>): any[] {
    const orderBy: any[] = [];

    Object.entries(sortOptions).forEach(([field, value]) => {
      if (!value) return;

      const direction = String(value).toLowerCase() === 'desc' ? 'desc' : 'asc';
      const realField = field.replace('sort_', '');
      
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
      else if (['id', 'contract_number', 'start_date', 'end_date', 'rent_amount', 
                'condo_fee', 'property_tax', 'extra_charges', 'commission_amount',
                'rent_due_day', 'tax_due_day', 'condo_due_day', 'created_at', 'updated_at'].includes(realField)) {
        orderBy.push({ [realField]: direction });
      }
    });

    if (orderBy.length === 0) {
      orderBy.push({ created_at: 'desc' });
    }

    return orderBy;
  }

  private static buildWhereClauseWithoutSearch(
    filters: Record<string, any>,
    includeInactive: boolean
  ): any {
    const where: any = {};
    
    if (!includeInactive) {
      where.deleted_at = null;
    }
    
    const filterConditions = this.buildFilterConditions(filters);
    if (Object.keys(filterConditions).length > 0) {
      where.AND = [filterConditions];
    }
    
    return where;
  }

  private static buildFilterConditions(filters: Record<string, any>): any {
    const conditions: any = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      if (['contract_number', 'rent_due_day', 'tax_due_day', 'condo_due_day'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (['rent_amount', 'condo_fee', 'property_tax', 'extra_charges', 'commission_amount'].includes(key)) {
        const floatValue = parseFloat(String(value));
        if (!isNaN(floatValue)) {
          conditions[key] = floatValue;
        }
      }
      else if (['start_date', 'end_date'].includes(key)) {
        conditions[key] = this.buildDateCondition(value);
      }
      else if (key === 'property_title') {
        if (!conditions.property) conditions.property = {};
        conditions.property.title = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (key === 'owner_name') {
        if (!conditions.owner) conditions.owner = {};
        conditions.owner.name = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (key === 'tenant_name') {
        if (!conditions.tenant) conditions.tenant = {};
        conditions.tenant.name = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (key === 'type_description') {
        if (!conditions.property) conditions.property = { type: {} };
        else if (!conditions.property.type) conditions.property.type = {};
        conditions.property.type.description = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (key === 'created_at') {
        conditions.created_at = this.buildDateCondition(value);
      }
    });
    
    return conditions;
  }

  private static buildDateCondition(value: any): any {
    if (typeof value === 'object' && value && 'from' in value && 'to' in value) {
      const dateRange = value as { from: string; to: string };
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        return { gte: fromDate, lte: toDate };
      }
    } 
    else if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        return { gte: startOfDay, lte: endOfDay };
      }
    }
    return {};
  }

  static async getLeaseById(id: string) {
    try {
      const lease = await prisma.lease.findUnique({
        where: { id, deleted_at: null },
        include: {
          property: {
            include: {
              type: true,
              addresses: { where: { deleted_at: null }, include: { address: true } },
              owner: true,
            }
          },
          owner: {
            include: {
              addresses: { where: { deleted_at: null }, include: { address: true } },
              contacts: { 
                where: { deleted_at: null }
                // CORRIGIDO: Removido include: { contact: true } pois contact não é relação
              }
            }
          },
          tenant: {
            include: {
              addresses: { where: { deleted_at: null }, include: { address: true } },
              contacts: { 
                where: { deleted_at: null }
                // CORRIGIDO: Removido include: { contact: true } pois contact não é relação
              }
            }
          },
          type: true
        }
      }) as any;

      if (!lease) throw new Error('Lease not found');
      return lease;

    } catch (error: any) {
      throw error;
    }
  }

  static async createLease(data: any) {
    try {
      const lease = await prisma.$transaction(async (tx: any) => {
        if (data.contract_number) {
          const existingContract = await tx.lease.findFirst({
            where: { contract_number: data.contract_number, deleted_at: null }
          });
          if (existingContract) throw new Error('Contract number already registered');
        }

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
      return lease;
    } catch (error: any) {
      throw error;
    }
  }

  static async updateLease(id: string, data: any) {
    try {
      const lease = await prisma.$transaction(async (tx: any) => {
        const existing = await tx.lease.findUnique({ where: { id, deleted_at: null } });
        if (!existing) throw new Error('Lease not found');

        if (data.contract_number && data.contract_number !== existing.contract_number) {
          const contractExists = await tx.lease.findFirst({
            where: { contract_number: data.contract_number, NOT: { id }, deleted_at: null }
          });
          if (contractExists) throw new Error('Contract number already registered for another lease');
        }

        const updatedLease = await tx.lease.update({
          where: { id },
          data: {
            property_id: data.property_id ?? existing.property_id,
            type_id: data.type_id ?? existing.type_id,
            owner_id: data.owner_id ?? existing.owner_id,
            tenant_id: data.tenant_id ?? existing.tenant_id,
            contract_number: data.contract_number ?? existing.contract_number,
            start_date: data.start_date ? new Date(data.start_date) : existing.start_date,
            end_date: data.end_date ? new Date(data.end_date) : existing.end_date,
            rent_amount: data.rent_amount ? Number(data.rent_amount) : existing.rent_amount,
            condo_fee: data.condo_fee !== undefined ? (data.condo_fee ? Number(data.condo_fee) : null) : existing.condo_fee,
            property_tax: data.property_tax !== undefined ? (data.property_tax ? Number(data.property_tax) : null) : existing.property_tax,
            extra_charges: data.extra_charges !== undefined ? (data.extra_charges ? Number(data.extra_charges) : null) : existing.extra_charges,
            commission_amount: data.commission_amount !== undefined ? (data.commission_amount ? Number(data.commission_amount) : null) : existing.commission_amount,
            rent_due_day: data.rent_due_day ? Number(data.rent_due_day) : existing.rent_due_day,
            tax_due_day: data.tax_due_day !== undefined ? (data.tax_due_day ? Number(data.tax_due_day) : null) : existing.tax_due_day,
            condo_due_day: data.condo_due_day !== undefined ? (data.condo_due_day ? Number(data.condo_due_day) : null) : existing.condo_due_day,
          }
        });
        return updatedLease;
      });
      return lease;
    } catch (error: any) {
      throw error;
    }
  }

  static async deleteLease(id: string) {
    try {
      const lease = await prisma.lease.findUnique({ where: { id, deleted_at: null } });
      if (!lease) throw new Error('Lease not found or already deleted');

      await prisma.lease.update({
        where: { id },
        data: { deleted_at: new Date() },
      });
      return lease;
    } catch (error: any) {
      throw error;
    }
  }

  static async restoreLease(id: string) {
    try {
      const lease = await prisma.lease.findUnique({ where: { id } });
      if (!lease) throw new Error('Lease not found');
      if (!lease.deleted_at) throw new Error('Lease is not deleted');

      await prisma.lease.update({
        where: { id },
        data: { deleted_at: null }
      });
      return lease;
    } catch (error: any) {
      throw error;
    }
  }

  static async getLeaseFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (key === 'contract_number') {
              where.contract_number = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
            } else if (key === 'property_title') {
              where.property = { title: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } };
            } else if (key === 'owner_name') {
              where.owner = { name: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } };
            } else if (key === 'tenant_name') {
              where.tenant = { name: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } };
            }
          }
        });
      }

      const [leases, properties, propertyTypes, owners, tenants, dateRange] = await Promise.all([
        prisma.lease.findMany({ where, select: { contract_number: true, start_date: true, end_date: true, rent_amount: true, condo_fee: true, property_tax: true, extra_charges: true, commission_amount: true, rent_due_day: true, tax_due_day: true, condo_due_day: true } }),
        prisma.property.findMany({ where: { deleted_at: null, leases: { some: where } }, select: { id: true, title: true }, orderBy: { title: 'asc' }, distinct: ['title'] }),
        prisma.propertyType.findMany({ where: { deleted_at: null, properties: { some: { deleted_at: null, leases: { some: where } } } }, select: { id: true, description: true }, orderBy: { description: 'asc' }, distinct: ['description'] }),
        prisma.owner.findMany({ where: { deleted_at: null, leases: { some: where } }, select: { id: true, name: true }, orderBy: { name: 'asc' }, distinct: ['name'] }),
        prisma.tenant.findMany({ where: { deleted_at: null, leases: { some: where } }, select: { id: true, name: true }, orderBy: { name: 'asc' }, distinct: ['name'] }),
        prisma.lease.aggregate({ where, _min: { created_at: true }, _max: { created_at: true } }),
      ]);

      const uniqueContractNumbers = [...new Set(leases.filter(l => l.contract_number).map(l => l.contract_number.trim()))].sort();
      const uniqueRentAmounts = [...new Set(leases.filter(l => l.rent_amount).map(l => l.rent_amount.toString()))].sort();
      const uniqueRentDueDays = [...new Set(leases.filter(l => l.rent_due_day).map(l => l.rent_due_day.toString()))].sort((a, b) => parseInt(a) - parseInt(b));
      const uniquePropertyTitles = [...new Set(properties.filter(p => p.title).map(p => p.title.trim()))].sort();
      const uniquePropertyTypes = [...new Set(propertyTypes.filter(t => t.description).map(t => t.description.trim()))].sort();
      const uniqueOwnerNames = [...new Set(owners.filter(o => o.name).map(o => o.name.trim()))].sort();
      const uniqueTenantNames = [...new Set(tenants.filter(t => t.name).map(t => t.name.trim()))].sort();

      const filtersList = [
        { field: 'contract_number', type: 'string', label: 'Número do Contrato', values: uniqueContractNumbers, searchable: true, autocomplete: true },
        { field: 'start_date', type: 'date', label: 'Data de Início', dateRange: true },
        { field: 'end_date', type: 'date', label: 'Data de Término', dateRange: true },
        { field: 'rent_amount', type: 'number', label: 'Valor do Aluguel', values: uniqueRentAmounts, searchable: true },
        { field: 'condo_fee', type: 'number', label: 'Valor do Condomínio', searchable: true },
        { field: 'property_tax', type: 'number', label: 'Valor do IPTU', searchable: true },
        { field: 'extra_charges', type: 'number', label: 'Taxas Extras', searchable: true },
        { field: 'commission_amount', type: 'number', label: 'Comissão', searchable: true },
        { field: 'rent_due_day', type: 'number', label: 'Dia de Vencimento do Aluguel', values: uniqueRentDueDays, searchable: true },
        { field: 'tax_due_day', type: 'number', label: 'Dia de Vencimento do IPTU', searchable: true },
        { field: 'condo_due_day', type: 'number', label: 'Dia de Vencimento do Condomínio', searchable: true },
        { field: 'property_title', type: 'string', label: 'Propriedade', values: uniquePropertyTitles, searchable: true, autocomplete: true },
        { field: 'type_description', type: 'string', label: 'Tipo de Propriedade', values: uniquePropertyTypes, searchable: true, autocomplete: true },
        { field: 'owner_name', type: 'string', label: 'Proprietário', values: uniqueOwnerNames, searchable: true, autocomplete: true },
        { field: 'tenant_name', type: 'string', label: 'Inquilino', values: uniqueTenantNames, searchable: true, autocomplete: true },
        { field: 'created_at', type: 'date', label: 'Criado em', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true }
      ];

      return {
        filters: filtersList,
        operators: { string: ['contains', 'equals', 'startsWith', 'endsWith'], number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'], date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'], boolean: ['equals'], select: ['equals', 'in'] },
        defaultSort: 'created_at:desc',
        searchFields: ['contract_number', 'property.title', 'owner.name', 'tenant.name', 'property.type.description']
      };

    } catch (error) {
      throw error;
    }
  }
}