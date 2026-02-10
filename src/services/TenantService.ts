import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';
import { 
  GetTenantsParams, 
  PaginatedTenantResponse, 
  TenantWithRelations
} from '../types/tenant';

export class TenantService {
  // Mapeamento atualizado para acesso direto (sem tabela pivô)
  // 'contacts.0.phone' acessa o primeiro item do array de contatos diretamente
  static readonly FIELD_MAPPING: Record<string, { 
    type: 'direct' | 'address' | 'contact', 
    realField: string,
    relationPath?: string 
  }> = {
    'name': { type: 'direct', realField: 'name' },
    'internal_code': { type: 'direct', realField: 'internal_code' },
    'occupation': { type: 'direct', realField: 'occupation' },
    'marital_status': { type: 'direct', realField: 'marital_status' },
    'cnpj': { type: 'direct', realField: 'cnpj' },
    'cpf': { type: 'direct', realField: 'cpf' },
    'state_registration': { type: 'direct', realField: 'state_registration' },  
    'municipal_registration': { type: 'direct', realField: 'municipal_registration' }, 
    'created_at': { type: 'direct', realField: 'created_at' },
    'updated_at': { type: 'direct', realField: 'updated_at' },
    
    // Endereços
    'city': { type: 'address', realField: 'city', relationPath: 'addresses.0.address.city' },
    'state': { type: 'address', realField: 'state', relationPath: 'addresses.0.address.state' },
    'district': { type: 'address', realField: 'district', relationPath: 'addresses.0.address.district' },
    'street': { type: 'address', realField: 'street', relationPath: 'addresses.0.address.street' },
    'zip_code': { type: 'address', realField: 'zip_code', relationPath: 'addresses.0.address.zip_code' },
    
    // Contatos (Acesso direto)
    'contact_name': { type: 'contact', realField: 'contact', relationPath: 'contacts.0.contact' },
    'phone': { type: 'contact', realField: 'phone', relationPath: 'contacts.0.phone' },
    'cellphone': { type: 'contact', realField: 'cellphone', relationPath: 'contacts.0.cellphone' },
    'email': { type: 'contact', realField: 'email', relationPath: 'contacts.0.email' }
  };

  private static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // Método auxiliar genérico para acesso seguro a propriedades aninhadas
  private static safeGetProperty(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
  }

  static async getTenants(params: GetTenantsParams = {}): Promise<PaginatedTenantResponse> {
    try {
      const { 
        limit = 30, 
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
      const sortDirection = sortOptions[sortField] || 'asc';
      
      let tenants: TenantWithRelations[] = [];
      let total = 0;

      const contactRelatedFields = ['city', 'state', 'district', 'street', 'zip_code', 
                                   'contact_name', 'phone', 'cellphone', 'email'];
      
      // Se houver busca global ou ordenação por campo relacionado, processar em memória
      if (search.trim() || (sortField && contactRelatedFields.includes(sortField))) {
        
        const allTenants = await prisma.tenant.findMany({
          where,
          include: {
            addresses: {
              where: { deleted_at: null },
              include: { address: true }
            },
            contacts: {
              where: { deleted_at: null }
            }
          }
        }) as unknown as TenantWithRelations[];

        let filteredTenants = allTenants;
        if (search.trim()) {
          filteredTenants = this.filterTenantsBySearch(allTenants, search);
        }

        total = filteredTenants.length;

        if (sortField) {
          if (contactRelatedFields.includes(sortField)) {
            tenants = this.sortByRelatedField(filteredTenants, sortField, sortDirection);
          } else {
            tenants = this.sortByDirectField(filteredTenants, sortField, sortDirection);
          }
        } else {
          // Ordenação padrão
          tenants = filteredTenants.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        tenants = tenants.slice(skip, skip + take);
      } else {
        // Busca otimizada no banco para campos diretos
        const orderBy = this.buildOrderBy(sortOptions);
        
        const [tenantsData, totalCount] = await Promise.all([
          prisma.tenant.findMany({
            where,
            skip,
            take,
            orderBy,
            include: {
              addresses: {
                where: { deleted_at: null },
                include: { address: true }
              },
              contacts: {
                where: { deleted_at: null }
              }
            }
          }),
          prisma.tenant.count({ where })
        ]);

        tenants = tenantsData as unknown as TenantWithRelations[];
        total = totalCount;
      }

      return {
        data: tenants,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in TenantService.getTenants:', error);
      throw new Error('Failed to fetch tenants: ' + error.message);
    }
  }

  // CORREÇÃO: Acesso direto às propriedades do contato (Contact[])
  private static filterTenantsBySearch(
    tenants: TenantWithRelations[],
    searchTerm: string
  ): TenantWithRelations[] {
    if (!searchTerm.trim()) return tenants;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return tenants.filter(tenant => {
      const directFields = [
        tenant.name,
        tenant.internal_code,
        tenant.cpf,
        tenant.cnpj
      ].filter(Boolean).join(' ');

      const addressFields = tenant.addresses
        ?.map(ta => ta.address)
        .filter(Boolean)
        .map(addr => [addr.street, addr.district, addr.city].filter(Boolean).join(' '))
        .join(' ') || '';

      // Casting para any[] para evitar erro de tipagem caso TenantWithRelations ainda esteja desatualizado
      const contacts = (tenant.contacts as any[]) || [];
      const contactFields = contacts
        .map(c => [
          c.contact, 
          c.phone, 
          c.cellphone, 
          c.email
        ].filter(Boolean).join(' '))
        .join(' ') || '';

      const allFields = [directFields, addressFields, contactFields].join(' ');
      return this.normalizeText(allFields).includes(normalizedSearchTerm);
    });
  }

  private static sortByDirectField<T>(items: T[], field: string, direction: 'asc' | 'desc'): T[] {
    return [...items].sort((a: any, b: any) => {
      const valueA = a[field] || '';
      const valueB = b[field] || '';
      const strA = this.normalizeText(String(valueA));
      const strB = this.normalizeText(String(valueB));
      return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }

  private static sortByRelatedField(
    items: any[],
    sortField: string,
    direction: 'asc' | 'desc'
  ): any[] {
    return [...items].sort((a, b) => {
      const fieldInfo = this.FIELD_MAPPING[sortField];
      if (!fieldInfo?.relationPath) return 0;

      const valueA = this.safeGetProperty(a, fieldInfo.relationPath) || '';
      const valueB = this.safeGetProperty(b, fieldInfo.relationPath) || '';

      const strA = this.normalizeText(String(valueA));
      const strB = this.normalizeText(String(valueB));

      return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }

  private static buildOrderBy(sortOptions: Record<string, 'asc' | 'desc'>): any[] {
    const orderBy: any[] = [];
    Object.entries(sortOptions).forEach(([field, value]) => {
      if (!value) return;
      const direction = String(value).toLowerCase() === 'desc' ? 'desc' : 'asc';
      const realField = field.replace('sort_', '');
      
      if (['name', 'internal_code', 'created_at', 'updated_at'].includes(realField)) {
        orderBy.push({ [realField]: direction });
      }
    });
    if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
    return orderBy;
  }

  private static buildWhereClauseWithoutSearch(filters: Record<string, any>, includeInactive: boolean): any {
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

  // CORREÇÃO: Filtros diretos em contacts
  private static buildFilterConditions(filters: Record<string, any>): any {
    const conditions: any = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      // Campos diretos
      if (['name', 'internal_code', 'cpf', 'cnpj', 'marital_status', 'occupation', 'state_registration', 'municipal_registration'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' };
      }
      // Endereços
      else if (['city', 'state', 'zip_code', 'street', 'district'].includes(key)) {
        if (!conditions.addresses) conditions.addresses = { some: { address: {} } };
        conditions.addresses.some.address[key] = { contains: String(value), mode: 'insensitive' };
      }
      // Contatos - Acesso direto
      else if (key === 'contact_name') {
        if (!conditions.contacts) conditions.contacts = { some: {} };
        conditions.contacts.some.contact = { contains: String(value), mode: 'insensitive' };
      }
      else if (['phone', 'cellphone', 'email'].includes(key)) {
        if (!conditions.contacts) conditions.contacts = { some: {} };
        conditions.contacts.some[key] = { contains: String(value), mode: 'insensitive' };
      }
      // Datas
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
        const start = new Date(date); start.setHours(0,0,0,0);
        const end = new Date(date); end.setHours(23,59,59,999);
        return { gte: start, lte: end };
      }
    }
    return {};
  }

  static async getTenantById(id: string) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id, deleted_at: null },
        include: {
          leases: true,
          addresses: {
            where: { deleted_at: null },
            include: { address: true }
          },
          contacts: {
            where: { deleted_at: null }
          }
        }
      }) as unknown as TenantWithRelations;

      if (!tenant) throw new Error('Tenant not found');
      return tenant;
    } catch (error: any) {
      throw error;
    }
  }

  static async createTenant(data: any) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (data.cpf && await tx.tenant.findFirst({ where: { cpf: data.cpf, deleted_at: null } })) {
          throw new Error('CPF already registered');
        }
        if (data.cnpj && await tx.tenant.findFirst({ where: { cnpj: data.cnpj, deleted_at: null } })) {
          throw new Error('CNPJ already registered');
        }

        const newTenant = await tx.tenant.create({
          data: {
            name: data.name,
            internal_code: data.internal_code,
            occupation: data.occupation,
            marital_status: data.marital_status,
            cpf: data.cpf || null,
            cnpj: data.cnpj || null,
            state_registration: data.state_registration || null,       
            municipal_registration: data.municipal_registration || null, 
            
            // Criação aninhada de contatos
            contacts: {
              create: data.contacts?.map((c: any) => ({
                contact: c.contact,
                phone: c.phone,
                cellphone: c.cellphone,
                email: c.email
              })) || []
            }
          }
        });

        // CORREÇÃO: Campos obrigatórios do endereço (number, district, city, state)
        if (data.addresses && data.addresses.length > 0) {
          for (const addr of data.addresses) {
            const newAddress = await tx.address.create({
              data: {
                zip_code: addr.zip_code,
                street: addr.street,
                number: addr.number,     // Obrigatório
                district: addr.district, // Obrigatório
                city: addr.city,         // Obrigatório
                state: addr.state,       // Obrigatório
                country: addr.country || 'Brasil',
              }
            });
            await tx.tenantAddress.create({
              data: { tenant_id: newTenant.id, address_id: newAddress.id }
            });
          }
        }
        return newTenant;
      });
    } catch (error: any) {
      throw error;
    }
  }

  static async updateTenant(id: string, data: any) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.tenant.findUnique({ where: { id, deleted_at: null } });
        if (!existing) throw new Error('Tenant not found');

        if (data.cpf && data.cpf !== existing.cpf) {
           const exists = await tx.tenant.findFirst({ where: { cpf: data.cpf, NOT: { id }, deleted_at: null } });
           if (exists) throw new Error('CPF already registered for another tenant');
        }

        await tx.tenant.update({
          where: { id },
          data: {
            name: data.name,
            internal_code: data.internal_code,
            occupation: data.occupation,
            marital_status: data.marital_status,
            cpf: data.cpf,
            cnpj: data.cnpj,
            state_registration: data.state_registration,
            municipal_registration: data.municipal_registration
          }
        });

        // Atualizar Contatos
        if (data.contacts !== undefined) {
          await tx.contact.deleteMany({ where: { tenant_id: id } });
          if (data.contacts.length > 0) {
            await tx.contact.createMany({
              data: data.contacts.map((c: any) => ({
                tenant_id: id,
                contact: c.contact,
                phone: c.phone,
                cellphone: c.cellphone,
                email: c.email
              }))
            });
          }
        }

        // Atualizar Endereços
        if (data.addresses !== undefined) {
          await tx.tenantAddress.deleteMany({ where: { tenant_id: id } });
          if (data.addresses.length > 0) {
             for (const addr of data.addresses) {
                // CORREÇÃO: Campos obrigatórios
                const newAddress = await tx.address.create({
                  data: {
                    zip_code: addr.zip_code,
                    street: addr.street,
                    number: addr.number,     // Obrigatório
                    district: addr.district, // Obrigatório
                    city: addr.city,         // Obrigatório
                    state: addr.state,       // Obrigatório
                    country: addr.country || 'Brasil'
                  }
                });
                await tx.tenantAddress.create({
                  data: { tenant_id: id, address_id: newAddress.id }
                });
             }
          }
        }
        return existing;
      });
    } catch (error: any) {
      throw error;
    }
  }

  static async deleteTenant(id: string) {
    return prisma.tenant.update({
      where: { id },
      data: { 
        deleted_at: new Date(),
        contacts: {
          updateMany: { where: { tenant_id: id }, data: { deleted_at: new Date() } }
        },
        addresses: {
          updateMany: { where: { tenant_id: id }, data: { deleted_at: new Date() } }
        }
      },
    });
  }

  static async restoreTenant(id: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant?.deleted_at) throw new Error('Tenant not deleted');

    return prisma.tenant.update({
      where: { id },
      data: { 
        deleted_at: null,
        contacts: {
          updateMany: { where: { tenant_id: id }, data: { deleted_at: null } }
        },
        addresses: {
          updateMany: { where: { tenant_id: id }, data: { deleted_at: null } }
        }
      }
    });
  }

  static async getTenantFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      
      if (filters) {
        const andFilters: any[] = [];
        Object.entries(filters).forEach(([key, value]) => {
           if (!value) return;
           const conditions = this.buildFilterConditions({ [key]: value });
           if (Object.keys(conditions).length) andFilters.push(conditions);
        });
        if (andFilters.length) where.AND = andFilters;
      }

      // Buscar tenants para preencher filtros
      const [tenants, addresses, contacts, dateRange] = await Promise.all([
        prisma.tenant.findMany({
          where,
          select: { name: true, internal_code: true, cpf: true, cnpj: true, occupation: true, marital_status: true, state_registration: true, municipal_registration: true },
          distinct: ['name', 'internal_code', 'cpf', 'cnpj', 'occupation', 'marital_status', 'state_registration', 'municipal_registration']
        }),
        prisma.address.findMany({
          where: { deleted_at: null, tenantAddresses: { some: { tenant: { deleted_at: null } } } },
          select: { city: true, state: true, district: true, street: true, zip_code: true },
          distinct: ['city', 'state', 'district', 'street', 'zip_code']
        }),
        // CORREÇÃO: Filtrar contatos pelo tenant_id
        prisma.contact.findMany({
          where: { deleted_at: null, tenant_id: { not: null }, tenant: { deleted_at: null } },
          select: { contact: true, phone: true, cellphone: true, email: true },
          distinct: ['contact', 'phone', 'cellphone', 'email']
        }),
        prisma.tenant.aggregate({
          where,
          _min: { created_at: true },
          _max: { created_at: true }
        })
      ]);

      const filtersList = [
        { field: 'name', type: 'string', label: 'Nome', values: [...new Set(tenants.map(t => t.name).filter(Boolean))].sort(), searchable: true },
        { field: 'internal_code', type: 'string', label: 'Código Interno', values: [...new Set(tenants.map(t => t.internal_code).filter(Boolean))].sort(), searchable: true },
        { field: 'cpf', type: 'string', label: 'CPF', values: [...new Set(tenants.map(t => t.cpf).filter(Boolean))].sort(), searchable: true },
        { field: 'cnpj', type: 'string', label: 'CNPJ', values: [...new Set(tenants.map(t => t.cnpj).filter(Boolean))].sort(), searchable: true },
        { field: 'occupation', type: 'string', label: 'Profissão', values: [...new Set(tenants.map(t => t.occupation).filter(Boolean))].sort(), searchable: true },
        { field: 'marital_status', type: 'string', label: 'Estado Civil', values: [...new Set(tenants.map(t => t.marital_status).filter(Boolean))].sort(), searchable: true },
        { field: 'state_registration', type: 'string', label: 'Inscrição Estadual', values: [...new Set(tenants.map(t => t.state_registration).filter(Boolean))].sort(), searchable: true },
        { field: 'municipal_registration', type: 'string', label: 'Inscrição Municipal', values: [...new Set(tenants.map(t => t.municipal_registration).filter(Boolean))].sort(), searchable: true },
        
        { field: 'city', type: 'string', label: 'Cidade', values: [...new Set(addresses.map(a => a.city).filter(Boolean))].sort(), searchable: true },
        { field: 'state', type: 'string', label: 'Estado', values: [...new Set(addresses.map(a => a.state).filter(Boolean))].sort(), searchable: true },
        { field: 'district', type: 'string', label: 'Bairro', values: [...new Set(addresses.map(a => a.district).filter(Boolean))].sort(), searchable: true },
        { field: 'street', type: 'string', label: 'Rua', values: [...new Set(addresses.map(a => a.street).filter(Boolean))].sort(), searchable: true },
        { field: 'zip_code', type: 'string', label: 'CEP', values: [...new Set(addresses.map(a => a.zip_code).filter(Boolean))].sort(), searchable: true },
        
        { field: 'contact_name', type: 'string', label: 'Nome do Contato', values: [...new Set(contacts.map(c => c.contact).filter(Boolean))].sort(), searchable: true },
        { field: 'phone', type: 'string', label: 'Telefone', values: [...new Set(contacts.map(c => c.phone).filter(Boolean))].sort(), searchable: true },
        { field: 'cellphone', type: 'string', label: 'Celular', values: [...new Set(contacts.map(c => c.cellphone).filter(Boolean))].sort(), searchable: true },
        { field: 'email', type: 'string', label: 'E-mail', values: [...new Set(contacts.map(c => c.email).filter(Boolean))].sort(), searchable: true },
        
        { 
          field: 'created_at', 
          type: 'date', 
          label: 'Criado em', 
          min: dateRange._min.created_at?.toISOString().split('T')[0], 
          max: dateRange._max.created_at?.toISOString().split('T')[0], 
          dateRange: true 
        }
      ];

      return {
        filters: filtersList,
        operators: {
          string: ['contains', 'equals', 'startsWith', 'endsWith'],
          number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
          date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
          boolean: ['equals'],
          select: ['equals', 'in']
        },
        defaultSort: 'created_at:desc',
        searchFields: ['name', 'internal_code', 'cpf', 'cnpj', 'occupation', 'marital_status', 'city', 'state', 'contact_name', 'phone', 'cellphone', 'email']
      };

    } catch (error) {
      throw error;
    }
  }
}