import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class AgencyService {
  // Mapeamento para ordenação ATUALIZADO
  static readonly FIELD_MAPPING: Record<string, { 
    type: 'direct' | 'address' | 'contact', 
    realField: string,
    relationPath?: string 
  }> = {
    'trade_name': { type: 'direct', realField: 'trade_name' },
    'legal_name': { type: 'direct', realField: 'legal_name' },
    'cnpj': { type: 'direct', realField: 'cnpj' },
    'state_registration': { type: 'direct', realField: 'state_registration' },
    'municipal_registration': { type: 'direct', realField: 'municipal_registration' },
    'license_number': { type: 'direct', realField: 'license_number' },
    'created_at': { type: 'direct', realField: 'created_at' },
    'updated_at': { type: 'direct', realField: 'updated_at' },
    
    // Campos de endereço
    'city': { type: 'address', realField: 'city', relationPath: 'addresses.0.address.city' },
    'state': { type: 'address', realField: 'state', relationPath: 'addresses.0.address.state' },
    'district': { type: 'address', realField: 'district', relationPath: 'addresses.0.address.district' },
    'street': { type: 'address', realField: 'street', relationPath: 'addresses.0.address.street' },
    'zip_code': { type: 'address', realField: 'zip_code', relationPath: 'addresses.0.address.zip_code' },
    
    // Campos de contato ATUALIZADOS
    'contact_name': { type: 'contact', realField: 'contact', relationPath: 'contacts.0.contact.contact' },
    'phone': { type: 'contact', realField: 'phone', relationPath: 'contacts.0.contact.phone' },
    'cellphone': { type: 'contact', realField: 'cellphone', relationPath: 'contacts.0.contact.cellphone' }, // ← NOVO
    'email': { type: 'contact', realField: 'email', relationPath: 'contacts.0.contact.email' }
    // REMOVIDO: 'whatsapp'
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

  // Método auxiliar para normalizar direção de ordenação
  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    if (direction.toLowerCase() === 'desc') {
      return 'desc';
    }
    return 'asc'; // default
  }

  // Método auxiliar para acesso seguro a propriedades aninhadas
  private static safeGetProperty<T>(obj: any, path: string): T | undefined {
    return path.split('.').reduce((acc, part) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[part];
    }, obj);
  }

  static async getAgencies(params: any = {}) {
    try {
      console.log('🔍 Executing getAgencies with params:', JSON.stringify(params, null, 2));
      
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
      const sortEntries = Object.entries(sortOptions) as any;
      const sortField = sortEntries.length > 0 ? sortEntries[0][0] : '';
      const sortDirection = sortEntries.length > 0 ? 
        this.normalizeSortDirection(sortEntries[0][1]) : 'asc';
      
      console.log(`🔧 Campo de ordenação: ${sortField} -> ${sortDirection}`);

      let agencies: any[] = [];
      let total = 0;

      // Se houver busca ou ordenação por campo relacionado, processar em memória
      const contactRelatedFields = ['city', 'state', 'district', 'street', 'zip_code', 
                                    'contact_name', 'phone', 'cellphone', 'email'];
      
      if (search.trim() || (sortField && sortDirection && contactRelatedFields.includes(sortField))) {
        
        console.log(`🔄 Processando em memória (busca: ${search.trim()}, ordenação relacionada: ${sortField})`);
        
        // Buscar TODOS os agencies para processamento em memória
        const allAgencies = await prisma.agency.findMany({
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
        });

        // Aplicar filtro de busca em memória se houver termo de busca
        let filteredAgencies = allAgencies;
        if (search.trim()) {
          filteredAgencies = this.filterAgenciesBySearch(allAgencies, search);
        }

        total = filteredAgencies.length;

        // Ordenar em memória se necessário
        if (sortField && sortDirection) {
          if (contactRelatedFields.includes(sortField)) {
            // Ordenação por campo relacionado
            agencies = this.sortAgenciesByRelatedField(filteredAgencies, sortField, sortDirection);
          } else if (['trade_name', 'legal_name', 'cnpj', 'state_registration', 
                      'municipal_registration', 'license_number', 'created_at', 'updated_at'].includes(sortField)) {
            // Ordenação por campo direto em memória
            agencies = this.sortByDirectField(filteredAgencies, sortField, sortDirection);
          }
        } else {
          // Ordenação padrão por data de criação (mais recente primeiro)
          agencies = filteredAgencies.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        // Aplicar paginação
        agencies = agencies.slice(skip, skip + take);
      } else {
        // Ordenação normal (por campos diretos) sem busca global
        const orderBy = this.buildOrderBy(sortOptions);
        
        console.log('📊 ORDER BY direto:', JSON.stringify(orderBy, null, 2));
        
        // Buscar com ordenação do Prisma
        const [agenciesData, totalCount] = await Promise.all([
          prisma.agency.findMany({
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
          prisma.agency.count({ where })
        ]);

        agencies = agenciesData;
        total = totalCount;
      }

      console.log(`✅ Encontradas ${agencies.length} agências, total: ${total}`);

      return {
        data: agencies,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Erro em AgencyService.getAgencies:', error);
      throw new Error(`Falha ao buscar agências: ${error.message}`);
    }
  }

  /**
   * Filtra agencies em memória com base no termo de busca (ignorando acentos) - ATUALIZADO
   */
  private static filterAgenciesBySearch(
    agencies: any[],
    searchTerm: string
  ): any[] {
    if (!searchTerm.trim()) return agencies;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return agencies.filter(agency => {
      // Campos diretos da agência
      const directFields = [
        agency.trade_name,
        agency.legal_name,
        agency.cnpj,
        agency.state_registration,
        agency.municipal_registration,
        agency.license_number
      ].filter(Boolean).join(' ');

      // Campos de endereço
      const addressFields = agency.addresses
        ?.map((ta: any) => ta.address)
        .filter(Boolean)
        .map((addr: any) => [
          addr.street,
          addr.district,
          addr.city,
          addr.state,
          addr.zip_code
        ].filter(Boolean).join(' '))
        .join(' ') || '';

      // Campos de contato - ATUALIZADO para incluir cellphone
      const contactFields = agency.contacts
        ?.map((tc: any) => tc.contact)
        .filter(Boolean)
        .map((contact: any) => [
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
  private static sortByDirectField(
    items: any[],
    field: string,
    direction: 'asc' | 'desc'
  ): any[] {
    return [...items].sort((a, b) => {
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

      // Campos diretos da agência
      if (['trade_name', 'legal_name', 'cnpj', 'state_registration', 
           'municipal_registration', 'license_number'].includes(key)) {
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
      else if (key === 'contact_name') {
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

  /**
   * Constrói ORDER BY considerando campos diretos e de relacionamento
   */
  private static buildOrderBy(sortOptions: Record<string, string>): any[] {
    const orderBy: any[] = [];

    Object.entries(sortOptions).forEach(([field, direction]) => {
      if (!direction) return;

      const normalizedDirection = this.normalizeSortDirection(direction);

      // Apenas campos diretos que o Prisma pode ordenar
      if (['trade_name', 'legal_name', 'cnpj', 'state_registration', 
           'municipal_registration', 'license_number', 'created_at', 'updated_at'].includes(field)) {
        orderBy.push({ [field]: normalizedDirection });
      }
    });

    if (orderBy.length === 0) {
      orderBy.push({ created_at: 'desc' });
    }

    return orderBy;
  }

  /**
   * Ordenação por campo relacionado - ATUALIZADO para incluir cellphone
   */
  private static sortAgenciesByRelatedField(
    agencies: any[], 
    sortField: string, 
    direction: 'asc' | 'desc'
  ): any[] {
    return [...agencies].sort((a, b) => {
      let valueA = '';
      let valueB = '';

      // Campos de endereço
      if (['city', 'state', 'district', 'street', 'zip_code'].includes(sortField)) {
        valueA = a.addresses?.[0]?.address?.[sortField] || '';
        valueB = b.addresses?.[0]?.address?.[sortField] || '';
      }
      // Campos de contato - ATUALIZADO
      else if (sortField === 'contact_name') {
        valueA = a.contacts?.[0]?.contact?.contact || '';
        valueB = b.contacts?.[0]?.contact?.contact || '';
      }
      else if (sortField === 'phone') {
        valueA = a.contacts?.[0]?.contact?.phone || '';
        valueB = b.contacts?.[0]?.contact?.phone || '';
      }
      else if (sortField === 'cellphone') { // ← NOVA ORDENAÇÃO
        valueA = a.contacts?.[0]?.contact?.cellphone || '';
        valueB = b.contacts?.[0]?.contact?.cellphone || '';
      }
      else if (sortField === 'email') {
        valueA = a.contacts?.[0]?.contact?.email || '';
        valueB = b.contacts?.[0]?.contact?.email || '';
      }

      // Normalizar os textos para comparação
      const strA = this.normalizeText(String(valueA));
      const strB = this.normalizeText(String(valueB));

      if (direction === 'asc') {
        return strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' });
      } else {
        return strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
      }
    });
  }

  static async getAgencyById(id: string) {
    try {
      console.log(`🔍 Getting agency by ID: ${id}`);
      
      const agency = await prisma.agency.findUnique({
        where: { 
          id,
          deleted_at: null
        },
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
      });

      if (!agency) {
        throw new Error('Agency not found');
      }

      console.log(`✅ Found agency: ${agency.trade_name}`);
      return agency;

    } catch (error: any) {
      console.error(`❌ Error getting agency ${id}:`, error);
      throw error;
    }
  }

  /**
   * Cria uma nova agência - ATUALIZADO para cellphone
   */
  static async createAgency(data: any) {
    try {
      console.log('➕ Creating new agency:', data.trade_name);
      
      const agency = await prisma.$transaction(async (tx: any) => {
        // Verificar CNPJ único
        const existing = await tx.agency.findFirst({
          where: { 
            cnpj: data.cnpj,
            deleted_at: null
          }
        });

        if (existing) {
          throw new Error('CNPJ already registered');
        }

        // Criar agência
        const newAgency = await tx.agency.create({
          data: {
            trade_name: data.trade_name,
            legal_name: data.legal_name,
            cnpj: data.cnpj,
            state_registration: data.state_registration,
            municipal_registration: data.municipal_registration,
            license_number: data.license_number,
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
                email: contact.email || null
              }
            });

            await tx.agencyContact.create({
              data: {
                agency_id: newAgency.id,
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

            await tx.agencyAddress.create({
              data: {
                agency_id: newAgency.id,
                address_id: newAddress.id
              }
            });
          }
        }

        return newAgency;
      });

      console.log(`✅ Agency created: ${agency.id}`);
      return agency;

    } catch (error: any) {
      console.error('❌ Error creating agency:', error);
      throw error;
    }
  }

  /**
   * Atualiza uma agência - ATUALIZADO para cellphone
   */
  static async updateAgency(id: string, data: any) {
    try {
      console.log(`✏️ Updating agency: ${id}`);
      
      const agency = await prisma.$transaction(async (tx: any) => {
        // Verificar se existe e não está deletada
        const existing = await tx.agency.findUnique({ 
          where: { 
            id,
            deleted_at: null 
          } 
        });
        
        if (!existing) {
          throw new Error('Agency not found');
        }

        // Verificar CNPJ único se mudou
        if (data.cnpj && data.cnpj !== existing.cnpj) {
          const cnpjExists = await tx.agency.findFirst({
            where: { 
              cnpj: data.cnpj, 
              NOT: { id },
              deleted_at: null
            }
          });
          
          if (cnpjExists) {
            throw new Error('CNPJ already registered for another agency');
          }
        }

        // Atualizar dados básicos
        const updatedAgency = await tx.agency.update({
          where: { id },
          data: {
            trade_name: data.trade_name,
            legal_name: data.legal_name,
            cnpj: data.cnpj,
            state_registration: data.state_registration,
            municipal_registration: data.municipal_registration,
            license_number: data.license_number,
          }
        });

        // Atualizar contatos (substituir todos) - ATUALIZADO para cellphone
        if (data.contacts !== undefined) {
          // Remover contatos existentes (soft delete)
          await tx.agencyContact.updateMany({
            where: { 
              agency_id: id,
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
                  email: contact.email || null
                }
              });

              await tx.agencyContact.create({
                data: {
                  agency_id: id,
                  contact_id: newContact.id
                }
              });
            }
          }
        }

        // Atualizar endereços (substituir todos)
        if (data.addresses !== undefined) {
          // Remover endereços existentes (soft delete)
          await tx.agencyAddress.updateMany({
            where: { 
              agency_id: id,
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

              await tx.agencyAddress.create({
                data: {
                  agency_id: id,
                  address_id: newAddress.id
                }
              });
            }
          }
        }

        return updatedAgency;
      });

      console.log(`✅ Agency updated: ${agency.id}`);
      return agency;

    } catch (error: any) {
      console.error(`❌ Error updating agency ${id}:`, error);
      throw error;
    }
  }

  static async deleteAgency(id: string) {
    try {
      console.log(`🗑️ Soft deleting agency: ${id}`);
      
      const agency = await prisma.agency.findUnique({
        where: { 
          id,
          deleted_at: null
        },
      });

      if (!agency) {
        throw new Error('Agency not found or already deleted');
      }

      const deletedAgency = await prisma.agency.update({
        where: { id },
        data: { 
          deleted_at: new Date(),
        },
      });

      console.log(`✅ Agency soft deleted: ${id}`);
      return agency;

    } catch (error: any) {
      console.error(`❌ Error soft deleting agency ${id}:`, error);
      throw error;
    }
  }

  static async restoreAgency(id: string) {
    try {
      console.log(`♻️ Restoring agency: ${id}`);
      
      const agency = await prisma.agency.findUnique({
        where: { id },
      });

      if (!agency) {
        throw new Error('Agency not found');
      }

      if (!agency.deleted_at) {
        throw new Error('Agency is not deleted');
      }

      const restoredAgency = await prisma.agency.update({
        where: { id },
        data: { 
          deleted_at: null,
        }
      });
      
      console.log(`✅ Agency restored: ${id}`);
      return agency;

    } catch (error: any) {
      console.error(`❌ Error restoring agency ${id}:`, error);
      throw error;
    }
  }

  /**
   * Obtém filtros para agências - ATUALIZADO para cellphone
   */
  static async getAgencyFilters(filters?: Record<string, any>) {
    try {
      console.log('🔍 Building comprehensive agency filters with context...');
      console.log('📦 Active filters for context:', filters);

      // Construir where clause com base nos filtros atuais
      const where: any = { deleted_at: null };
      
      if (filters) {
        const andFilters: any[] = [];
        
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            // Campos diretos
            if (['trade_name', 'legal_name', 'cnpj', 'state_registration', 
                 'municipal_registration', 'license_number'].includes(key)) {
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
            else if (key === 'contact_name') {
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
        agencies,
        addresses,
        contacts,
        dateRange
      ] = await Promise.all([
        // Agências
        prisma.agency.findMany({
          where,
          select: {
            trade_name: true,
            legal_name: true,
            cnpj: true,
            state_registration: true,
            municipal_registration: true,
            license_number: true
          },
          distinct: ['trade_name', 'legal_name', 'cnpj', 'state_registration', 
                     'municipal_registration', 'license_number']
        }),
        // Endereços
        prisma.address.findMany({
          where: {
            deleted_at: null,
            agencyAddresses: {
              some: {
                agency: {
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
            agencyContacts: {
              some: {
                agency: {
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
        prisma.agency.aggregate({
          where,
          _min: { created_at: true },
          _max: { created_at: true }
        })
      ]);

      console.log(`📈 Found ${agencies.length} agencies for filters`);

      // Extrair valores únicos
      const uniqueTradeNames = Array.from(new Set(
        agencies.filter(a => a.trade_name).map(a => a.trade_name!.trim())
      )).sort();

      const uniqueLegalNames = Array.from(new Set(
        agencies.filter(a => a.legal_name).map(a => a.legal_name!.trim())
      )).sort();

      const uniqueCnpjs = Array.from(new Set(
        agencies.filter(a => a.cnpj).map(a => a.cnpj!.trim())
      )).sort();

      const uniqueStateRegistrations = Array.from(new Set(
        agencies.filter(a => a.state_registration).map(a => a.state_registration!.trim())
      )).sort();

      const uniqueMunicipalRegistrations = Array.from(new Set(
        agencies.filter(a => a.municipal_registration).map(a => a.municipal_registration!.trim())
      )).sort();

      const uniqueLicenseNumbers = Array.from(new Set(
        agencies.filter(a => a.license_number).map(a => a.license_number!.trim())
      )).sort();

      const uniqueCities = Array.from(new Set(
        addresses.filter(a => a.city).map(a => a.city.trim())
      )).sort();

      const uniqueStates = Array.from(new Set(
        addresses.filter(a => a.state).map(a => a.state.trim())
      )).sort();

      const uniqueDistricts = Array.from(new Set(
        addresses.filter(a => a.district).map(a => a.district.trim())
      )).sort();

      const uniqueStreets = Array.from(new Set(
        addresses.filter(a => a.street).map(a => a.street.trim())
      )).sort();

      const uniqueZipCodes = Array.from(new Set(
        addresses.filter(a => a.zip_code).map(a => a.zip_code.trim())
      )).sort();

      const uniqueContactNames = Array.from(new Set(
        contacts.filter(c => c.contact).map(c => c.contact?.trim())
      )).sort();

      const uniquePhones = Array.from(new Set(
        contacts.filter(c => c.phone).map(c => c.phone?.trim())
      )).sort();

      const uniqueCellphones = Array.from(new Set( // ← NOVO FILTRO
        contacts.filter(c => c.cellphone).map(c => c.cellphone?.trim())
      )).sort();

      const uniqueEmails = Array.from(new Set(
        contacts.filter(c => c.email).map(c => c.email!.trim())
      )).sort();

      // Construir lista completa de filtros - ATUALIZADO
      const filtersList = [
        {
          field: 'trade_name',
          type: 'string',
          label: 'Nome Fantasia',
          description: 'Nome comercial da imobiliária',
          values: uniqueTradeNames,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'legal_name',
          type: 'string',
          label: 'Razão Social',
          description: 'Nome jurídico da empresa',
          values: uniqueLegalNames,
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
          description: 'Registro estadual',
          values: uniqueStateRegistrations,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'municipal_registration',
          type: 'string',
          label: 'Inscrição Municipal',
          description: 'Registro municipal',
          values: uniqueMunicipalRegistrations,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'license_number',
          type: 'string',
          label: 'Número da Licença',
          description: 'Número do registro CRECI',
          values: uniqueLicenseNumbers,
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
        // Campos de endereço
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
        // Campos de contato - ATUALIZADO
        {
          field: 'contact_name',
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
          'trade_name',
          'legal_name',
          'cnpj',
          'state_registration',
          'municipal_registration',
          'license_number',
          'city',
          'state',
          'district',
          'street',
          'zip_code',
          'contact_name',
          'phone',
          'cellphone', // ← NOVO CAMPO DE BUSCA
          'email'
        ]
      };

    } catch (error) {
      console.error('❌ Error getting agency filters:', error);
      throw error;
    }
  }
}