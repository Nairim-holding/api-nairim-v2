import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';
import { 
  GetTenantsParams, 
  PaginatedTenantResponse, 
  TenantWithRelations,
  Address,
  Contact
} from '../types/tenant';

export class TenantService {
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
    
    // Campos de endereço
    'city': { type: 'address', realField: 'city', relationPath: 'addresses.0.address.city' },
    'state': { type: 'address', realField: 'state', relationPath: 'addresses.0.address.state' },
    'district': { type: 'address', realField: 'district', relationPath: 'addresses.0.address.district' },
    'street': { type: 'address', realField: 'street', relationPath: 'addresses.0.address.street' },
    'zip_code': { type: 'address', realField: 'zip_code', relationPath: 'addresses.0.address.zip_code' },
    
    // Campos de contato - ATUALIZADO: removido whatsapp, adicionado cellphone
    'contact_name': { type: 'contact', realField: 'contact', relationPath: 'contacts.0.contact.contact' },
    'phone': { type: 'contact', realField: 'phone', relationPath: 'contacts.0.contact.phone' },
    'cellphone': { type: 'contact', realField: 'cellphone', relationPath: 'contacts.0.contact.cellphone' }, // ← NOVO CAMPO
    'email': { type: 'contact', realField: 'email', relationPath: 'contacts.0.contact.email' }
    // REMOVIDO: whatsapp
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

  // Método auxiliar para ordenação por relacionamento em memória - ATUALIZADO
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

      if (fieldInfo.type === 'address' || fieldInfo.type === 'contact') {
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

  static async getTenants(params: GetTenantsParams = {}): Promise<PaginatedTenantResponse> {
    try {
      console.log('🔍 Executando getTenants com params:', JSON.stringify(params, null, 2));
      
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

      // Construir where clause sem busca global
      const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);
      
      // Verificar tipo de ordenação
      const sortField = Object.keys(sortOptions)[0];
      const sortDirection = sortOptions[sortField];
      
      console.log(`🔧 Campo de ordenação: ${sortField} -> ${sortDirection}`);

      let tenants: TenantWithRelations[] = [];
      let total = 0;

      // Se houver busca ou ordenação por campo relacionado, buscar todos para processar em memória
      const contactRelatedFields = ['city', 'state', 'district', 'street', 'zip_code', 
                                   'contact_name', 'phone', 'cellphone', 'email'];
      
      if (search.trim() || (sortField && sortDirection && contactRelatedFields.includes(sortField))) {
        console.log(`🔄 Processando em memória (busca: ${search.trim()}, ordenação relacionada: ${sortField})`);
        
        // Buscar TODOS os tenants para processamento em memória
        const allTenants = await prisma.tenant.findMany({
          where,
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
        }) as unknown as TenantWithRelations[];

        // Aplicar filtro de busca em memória se houver termo de busca
        let filteredTenants = allTenants;
        if (search.trim()) {
          filteredTenants = this.filterTenantsBySearch(allTenants, search);
        }

        total = filteredTenants.length;

        // Ordenar em memória se necessário
        if (sortField && sortDirection) {
          if (contactRelatedFields.includes(sortField)) {
            // Ordenação por campo relacionado
            tenants = this.sortByRelatedField(filteredTenants, sortField, sortDirection, this.FIELD_MAPPING);
          } else if (['name', 'internal_code', 'occupation', 'marital_status', 'cpf', 'cnpj', 
                      'state_registration', 'municipal_registration', 'created_at', 'updated_at'].includes(sortField)) {
            // Ordenação por campo direto em memória
            tenants = this.sortByDirectField(filteredTenants, sortField, sortDirection);
          }
        } else {
          // Ordenação padrão por data de criação (mais recente primeiro)
          tenants = filteredTenants.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        // Aplicar paginação
        tenants = tenants.slice(skip, skip + take);
      } else {
        // Ordenação normal (por campos diretos) sem busca global
        const orderBy = this.buildOrderBy(sortOptions);
        
        console.log('📊 ORDER BY direto:', JSON.stringify(orderBy, null, 2));
        
        // Buscar com ordenação do Prisma
        const [tenantsData, totalCount] = await Promise.all([
          prisma.tenant.findMany({
            where,
            skip,
            take,
            orderBy,
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
          }),
          prisma.tenant.count({ where })
        ]);

        tenants = tenantsData as unknown as TenantWithRelations[];
        total = totalCount;
      }

      console.log(`✅ Encontrados ${tenants.length} inquilinos, total: ${total}`);

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

  /**
   * Filtra tenants em memória com base no termo de busca - ATUALIZADO para cellphone
   */
  private static filterTenantsBySearch(
    tenants: TenantWithRelations[],
    searchTerm: string
  ): TenantWithRelations[] {
    if (!searchTerm.trim()) return tenants;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return tenants.filter(tenant => {
      // Campos diretos do tenant
      const directFields = [
        tenant.name,
        tenant.internal_code,
        tenant.occupation,
        tenant.marital_status,
        tenant.cpf,
        tenant.cnpj,
        tenant.state_registration,       
        tenant.municipal_registration 
      ].filter(Boolean).join(' ');

      // Campos de endereço
      const addressFields = tenant.addresses
        ?.map(ta => ta.address)
        .filter(Boolean)
        .map(addr => [
          addr.street,
          addr.district,
          addr.city,
          addr.state,
          addr.zip_code
        ].filter(Boolean).join(' '))
        .join(' ') || '';

      // Campos de contato - ATUALIZADO para incluir cellphone
      const contactFields = tenant.contacts
        ?.map(tc => tc.contact)
        .filter(Boolean)
        .map(contact => [
          contact.contact,
          contact.phone,
          contact.cellphone, // ← NOVO CAMPO
          contact.email
        ].filter(Boolean).join(' '))
        .join(' ') || '';

      // Combinar todos os campos
      const allFields = [
        directFields,
        addressFields,
        contactFields
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

      // Campos diretos que o Prisma pode ordenar
      if (['name', 'internal_code', 'occupation', 'marital_status', 'cpf', 'cnpj', 
           'state_registration', 'municipal_registration', 'created_at', 'updated_at'].includes(realField)) {
        orderBy.push({ [realField]: direction });
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
   * Constrói condições de filtro específicas - ATUALIZADO para cellphone
   */
  private static buildFilterConditions(filters: Record<string, any>): any {
    const conditions: any = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      console.log(`🔄 Aplicando filtro ${key}:`, value);

      // Campos diretos do inquilino
      if (['name', 'internal_code', 'occupation', 'marital_status', 
           'cpf', 'cnpj', 'state_registration', 'municipal_registration'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      // Campos de endereço
      else if (['city', 'state', 'district', 'street', 'zip_code'].includes(key)) {
        if (!conditions.addresses) {
          conditions.addresses = { some: { address: {} } };
        }
        conditions.addresses.some.address[key] = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      // Campos de contato - ATUALIZADO
      else if (key === 'contact') {
        if (!conditions.contacts) {
          conditions.contacts = { some: { contact: {} } };
        }
        conditions.contacts.some.contact.contact = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      else if (key === 'phone') {
        if (!conditions.contacts) {
          conditions.contacts = { some: { contact: {} } };
        }
        conditions.contacts.some.contact.phone = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      else if (key === 'cellphone') { // ← NOVO FILTRO
        if (!conditions.contacts) {
          conditions.contacts = { some: { contact: {} } };
        }
        conditions.contacts.some.contact.cellphone = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      else if (key === 'email') {
        if (!conditions.contacts) {
          conditions.contacts = { some: { contact: {} } };
        }
        conditions.contacts.some.contact.email = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      // Campo de data
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

  static async getTenantById(id: string) {
    try {
      console.log(`🔍 Getting tenant by ID: ${id}`);
      
      const tenant = await prisma.tenant.findUnique({
        where: { 
          id,
          deleted_at: null
        },
        include: {
          leases: true,
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
      }) as unknown as TenantWithRelations;

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      console.log(`✅ Found tenant: ${tenant.name}`);
      return tenant;

    } catch (error: any) {
      console.error(`❌ Error getting tenant ${id}:`, error);
      throw error;
    }
  }

  /**
   * Cria um novo inquilino - ATUALIZADO para cellphone
   */
  static async createTenant(data: any) {
    try {
      console.log('➕ Creating new tenant:', data.name);
      
      const tenant = await prisma.$transaction(async (tx: any) => {
        // Verificar CPF único se fornecido
        if (data.cpf) {
          const existingCPF = await tx.tenant.findFirst({
            where: { 
              cpf: data.cpf,
              deleted_at: null
            }
          });

          if (existingCPF) {
            throw new Error('CPF already registered');
          }
        }

        // Verificar CNPJ único se fornecido
        if (data.cnpj) {
          const existingCNPJ = await tx.tenant.findFirst({
            where: { 
              cnpj: data.cnpj,
              deleted_at: null
            }
          });

          if (existingCNPJ) {
            throw new Error('CNPJ already registered');
          }
        }

        // Criar inquilino
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
          }
        });

        // Adicionar contatos - ATUALIZADO para cellphone
        if (data.contacts && data.contacts.length > 0) {
          for (const contact of data.contacts) {
            const newContact = await tx.contact.create({
              data: {
                contact: contact.contact || null,
                phone: contact.phone || null,
                cellphone: contact.cellphone || null, // ← NOVO CAMPO
                email: contact.email || null,
                // REMOVIDO: whatsapp
              }
            });

            await tx.tenantContact.create({
              data: {
                tenant_id: newTenant.id,
                contact_id: newContact.id
              }
            });
          }
        }

        // Adicionar endereços
        if (data.addresses && data.addresses.length > 0) {
          for (const address of data.addresses) {
            const newAddress = await tx.address.create({
              data: {
                zip_code: address.zip_code,
                street: address.street,
                number: address.number,
                district: address.district,
                city: address.city,
                state: address.state,
                country: address.country || 'Brasil',
              }
            });

            await tx.tenantAddress.create({
              data: {
                tenant_id: newTenant.id,
                address_id: newAddress.id
              }
            });
          }
        }

        return newTenant;
      });

      console.log(`✅ Tenant created: ${tenant.id}`);
      return tenant;

    } catch (error: any) {
      console.error('❌ Error creating tenant:', error);
      throw error;
    }
  }

  /**
   * Atualiza um inquilino - ATUALIZADO para cellphone
   */
  static async updateTenant(id: string, data: any) {
    try {
      console.log(`✏️ Updating tenant: ${id}`);
      
      const tenant = await prisma.$transaction(async (tx: any) => {
        // Verificar se existe e não está deletada
        const existing = await tx.tenant.findUnique({ 
          where: { 
            id,
            deleted_at: null 
          } 
        });
        
        if (!existing) {
          throw new Error('Tenant not found');
        }

        // Verificar CPF único se mudou
        if (data.cpf && data.cpf !== existing.cpf) {
          const cpfExists = await tx.tenant.findFirst({
            where: { 
              cpf: data.cpf, 
              NOT: { id },
              deleted_at: null
            }
          });
          
          if (cpfExists) {
            throw new Error('CPF already registered for another tenant');
          }
        }

        // Verificar CNPJ único se mudou
        if (data.cnpj && data.cnpj !== existing.cnpj) {
          const cnpjExists = await tx.tenant.findFirst({
            where: { 
              cnpj: data.cnpj, 
              NOT: { id },
              deleted_at: null
            }
          });
          
          if (cnpjExists) {
            throw new Error('CNPJ already registered for another tenant');
          }
        }

        // Atualizar dados básicos
        const updatedTenant = await tx.tenant.update({
          where: { id },
          data: {
            name: data.name,
            internal_code: data.internal_code,
            occupation: data.occupation,
            marital_status: data.marital_status,
            cpf: data.cpf !== undefined ? data.cpf : existing.cpf,
            cnpj: data.cnpj !== undefined ? data.cnpj : existing.cnpj,
            state_registration: data.state_registration !== undefined ? data.state_registration : existing.state_registration,
            municipal_registration: data.municipal_registration !== undefined ? data.municipal_registration : existing.municipal_registration,
          }
        });

        // Atualizar contatos (substituir todos) se fornecido - ATUALIZADO para cellphone
        if (data.contacts !== undefined) {
          // Soft delete dos contatos existentes
          await tx.tenantContact.updateMany({
            where: { 
              tenant_id: id,
              deleted_at: null 
            },
            data: { deleted_at: new Date() }
          });

          // Adicionar novos contatos
          if (data.contacts && data.contacts.length > 0) {
            for (const contact of data.contacts) {
              const newContact = await tx.contact.create({
                data: {
                  contact: contact.contact || null,
                  phone: contact.phone || null,
                  cellphone: contact.cellphone || null, // ← NOVO CAMPO
                  email: contact.email || null,
                }
              });

              await tx.tenantContact.create({
                data: {
                  tenant_id: id,
                  contact_id: newContact.id
                }
              });
            }
          }
        }

        // Atualizar endereços (substituir todos) se fornecido
        if (data.addresses !== undefined) {
          // Soft delete dos endereços existentes
          await tx.tenantAddress.updateMany({
            where: { 
              tenant_id: id,
              deleted_at: null 
            },
            data: { deleted_at: new Date() }
          });

          // Adicionar novos endereços
          if (data.addresses && data.addresses.length > 0) {
            for (const address of data.addresses) {
              const newAddress = await tx.address.create({
                data: {
                  zip_code: address.zip_code,
                  street: address.street,
                  number: address.number,
                  district: address.district,
                  city: address.city,
                  state: address.state,
                  country: address.country || 'Brasil',
                }
              });

              await tx.tenantAddress.create({
                data: {
                  tenant_id: id,
                  address_id: newAddress.id
                }
              });
            }
          }
        }

        return updatedTenant;
      });

      console.log(`✅ Tenant updated: ${tenant.id}`);
      return tenant;

    } catch (error: any) {
      console.error(`❌ Error updating tenant ${id}:`, error);
      throw error;
    }
  }

  static async deleteTenant(id: string) {
    try {
      console.log(`🗑️ Soft deleting tenant: ${id}`);
      
      // Verificar se o inquilino existe e não está deletado
      const tenant = await prisma.tenant.findUnique({
        where: { 
          id,
          deleted_at: null
        },
      });

      if (!tenant) {
        throw new Error('Tenant not found or already deleted');
      }

      // SOFT DELETE
      await prisma.tenant.update({
        where: { id },
        data: { 
          deleted_at: new Date(),
          contacts: {
            updateMany: {
              where: { tenant_id: id },
              data: { deleted_at: new Date() }
            }
          },
          addresses: {
            updateMany: {
              where: { tenant_id: id },
              data: { deleted_at: new Date() }
            }
          }
        },
      });

      console.log(`✅ Tenant soft deleted: ${id}`);
      return tenant;

    } catch (error: any) {
      console.error(`❌ Error soft deleting tenant ${id}:`, error);
      throw error;
    }
  }

  static async restoreTenant(id: string) {
    try {
      console.log(`♻️ Restoring tenant: ${id}`);
      
      // Verificar se o inquilino existe
      const tenant = await prisma.tenant.findUnique({
        where: { id },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      if (!tenant.deleted_at) {
        throw new Error('Tenant is not deleted');
      }

      // Restaurar
      await prisma.tenant.update({
        where: { id },
        data: { 
          deleted_at: null,
          contacts: {
            updateMany: {
              where: { tenant_id: id },
              data: { deleted_at: null }
            }
          },
          addresses: {
            updateMany: {
              where: { tenant_id: id },
              data: { deleted_at: null }
            }
          }
        }
      });
      
      console.log(`✅ Tenant restored: ${id}`);
      return tenant;

    } catch (error: any) {
      console.error(`❌ Error restoring tenant ${id}:`, error);
      throw error;
    }
  }

  /**
   * Obtém filtros para inquilinos - ATUALIZADO para cellphone
   */
  static async getTenantFilters(filters?: Record<string, any>) {
    try {
      console.log('🔍 Building comprehensive tenant filters with context...');
      console.log('📦 Active filters for context:', filters);

      // Construir where clause com base nos filtros atuais
      const where: any = { deleted_at: null };
      
      if (filters) {
        const andFilters: any[] = [];
        
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            // Campos diretos
            if (['name', 'internal_code', 'occupation', 'marital_status', 
                'cpf', 'cnpj', 'state_registration', 'municipal_registration'].includes(key)) {
              andFilters.push({
                [key]: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode }
              });
            }
            // Campos de endereço
            else if (['city', 'state', 'district', 'street', 'zip_code'].includes(key)) {
              andFilters.push({ 
                addresses: { 
                  some: { 
                    address: { 
                      [key]: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } 
                    } 
                  } 
                } 
              });
            }
            // Campos de contato - ATUALIZADO
            else if (key === 'contact') {
              andFilters.push({ 
                contacts: { 
                  some: { 
                    contact: { 
                      contact: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } 
                    } 
                  } 
                } 
              });
            }
            else if (key === 'phone') {
              andFilters.push({ 
                contacts: { 
                  some: { 
                    contact: { 
                      phone: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } 
                    } 
                  } 
                } 
              });
            }
            else if (key === 'cellphone') { // ← NOVO FILTRO
              andFilters.push({ 
                contacts: { 
                  some: { 
                    contact: { 
                      cellphone: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } 
                    } 
                  } 
                } 
              });
            }
            else if (key === 'email') {
              andFilters.push({ 
                contacts: { 
                  some: { 
                    contact: { 
                      email: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } 
                    } 
                  } 
                } 
              });
            }
          }
        });

        if (andFilters.length > 0) {
          where.AND = andFilters;
        }
      }

      console.log('📊 WHERE clause para filtros contextuais:', JSON.stringify(where, null, 2));

      // Buscar todos os dados necessários para os filtros em paralelo
      const [
        tenants,
        addresses,
        contacts,
        dateRange
      ] = await Promise.all([
        // Inquilinos
        prisma.tenant.findMany({
          where,
          select: {
            name: true,
            internal_code: true,
            occupation: true,
            marital_status: true,
            cpf: true,
            cnpj: true,
            state_registration: true,
            municipal_registration: true,
          },
        }),
        // Endereços
        prisma.address.findMany({
          where: {
            deleted_at: null,
            tenantAddresses: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          },
          select: {
            city: true,
            state: true,
            district: true,
            street: true,
            zip_code: true
          },
          distinct: ['city', 'state', 'district', 'street', 'zip_code']
        }),
        // Contatos - ATUALIZADO para incluir cellphone
        prisma.contact.findMany({
          where: {
            deleted_at: null,
            tenantContacts: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          },
          select: {
            contact: true,
            phone: true,
            cellphone: true, // ← NOVO CAMPO
            email: true
          },
          distinct: ['contact', 'phone', 'cellphone', 'email']
        }),
        // Data range
        prisma.tenant.aggregate({
          where,
          _min: { created_at: true },
          _max: { created_at: true }
        })
      ]);

      console.log(`📈 Found ${tenants.length} tenants for filters`);

      // Extrair valores únicos
      const uniqueNames = [...new Set(tenants.filter(t => t.name).map(t => t.name.trim()))].sort();
      const uniqueInternalCodes = [...new Set(tenants.filter(t => t.internal_code).map(t => t.internal_code.trim()))].sort();
      const uniqueOccupations = [...new Set(tenants.filter(t => t.occupation).map(t => t.occupation.trim()))].sort();
      const uniqueMaritalStatuses = [...new Set(tenants.filter(t => t.marital_status).map(t => t.marital_status.trim()))].sort();
      const uniqueCpfs = [...new Set(tenants.filter(t => t.cpf).map(t => t.cpf!.trim()))].sort();
      const uniqueCnpjs = [...new Set(tenants.filter(t => t.cnpj).map(t => t.cnpj!.trim()))].sort();
      const uniqueStateRegistrations = [...new Set(tenants.filter(t => t.state_registration).map(t => t.state_registration!.trim()))].sort();
      const uniqueMunicipalRegistrations = [...new Set(tenants.filter(t => t.municipal_registration).map(t => t.municipal_registration!.trim()))].sort();

      const uniqueCities = [...new Set(addresses.filter(a => a.city).map(a => a.city.trim()))].sort();
      const uniqueStates = [...new Set(addresses.filter(a => a.state).map(a => a.state.trim()))].sort();
      const uniqueDistricts = [...new Set(addresses.filter(a => a.district).map(a => a.district.trim()))].sort();
      const uniqueStreets = [...new Set(addresses.filter(a => a.street).map(a => a.street.trim()))].sort();
      const uniqueZipCodes = [...new Set(addresses.filter(a => a.zip_code).map(a => a.zip_code.trim()))].sort();

      const uniqueContactNames = [...new Set(contacts.filter(c => c.contact).map(c => c.contact?.trim()))].sort();
      const uniquePhones = [...new Set(contacts.filter(c => c.phone).map(c => c.phone?.trim()))].sort();
      const uniqueCellphones = [...new Set(contacts.filter(c => c.cellphone).map(c => c.cellphone?.trim()))].sort(); // ← NOVO
      const uniqueEmails = [...new Set(contacts.filter(c => c.email).map(c => c.email!.trim()))].sort();

      // Construir lista completa de filtros - ATUALIZADO
      const filtersList = [
        {
          field: 'name',
          type: 'string',
          label: 'Nome',
          description: 'Nome completo do inquilino',
          values: uniqueNames,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'internal_code',
          type: 'string',
          label: 'Código Interno',
          description: 'Código interno do inquilino',
          values: uniqueInternalCodes,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'occupation',
          type: 'string',
          label: 'Profissão',
          description: 'Profissão/ocupação',
          values: uniqueOccupations,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'marital_status',
          type: 'string',
          label: 'Estado Civil',
          description: 'Estado civil',
          values: uniqueMaritalStatuses,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'cpf',
          type: 'string',
          label: 'CPF',
          description: 'Cadastro de Pessoa Física',
          values: uniqueCpfs,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'cnpj',
          type: 'string',
          label: 'CNPJ',
          description: 'Cadastro Nacional da Pessoa Jurídica',
          values: uniqueCnpjs,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'state_registration',
          type: 'string',
          label: 'Inscrição Estadual',
          description: 'Número da inscrição estadual',
          values: uniqueStateRegistrations,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'municipal_registration',
          type: 'string',
          label: 'Inscrição Municipal',
          description: 'Número da inscrição municipal',
          values: uniqueMunicipalRegistrations,
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
        },
        {
          field: 'city',
          type: 'string',
          label: 'Cidade',
          description: 'Cidade do endereço',
          values: uniqueCities,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'state',
          type: 'string',
          label: 'Estado',
          description: 'Estado do endereço',
          values: uniqueStates,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'district',
          type: 'string',
          label: 'Bairro',
          description: 'Bairro do endereço',
          values: uniqueDistricts,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'street',
          type: 'string',
          label: 'Rua',
          description: 'Rua do endereço',
          values: uniqueStreets,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'zip_code',
          type: 'string',
          label: 'CEP',
          description: 'CEP do endereço',
          values: uniqueZipCodes,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'contact',
          type: 'string',
          label: 'Nome do Contato',
          description: 'Nome da pessoa para contato',
          values: uniqueContactNames,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'phone',
          type: 'string',
          label: 'Telefone',
          description: 'Número de telefone para contato',
          values: uniquePhones,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'cellphone', // ← NOVO FILTRO
          type: 'string',
          label: 'Celular',
          description: 'Número de celular para contato',
          values: uniqueCellphones,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'email',
          type: 'string',
          label: 'E-mail',
          description: 'E-mail para contato',
          values: uniqueEmails,
          searchable: true,
          autocomplete: true
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
          'name',
          'internal_code',
          'cpf',
          'cnpj',
          'state_registration',
          'municipal_registration',
          'occupation',
          'marital_status',
          'city',
          'state',
          'district',
          'street',
          'zip_code',
          'contact',
          'phone',
          'cellphone', // ← NOVO CAMPO DE BUSCA
          'email'
        ]
      };

    } catch (error) {
      console.error('❌ Error getting tenant filters:', error);
      throw error;
    }
  }
}