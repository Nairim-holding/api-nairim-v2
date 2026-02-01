import prisma from '../lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import {
  GetOwnersParams,
  PaginatedOwnerResponse,
  CreateOwnerInput,
  UpdateOwnerInput,
  OwnerWithRelations
} from '../types/owner';

export class OwnerService {
  // Mapeamento atualizado para ordenação
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
    
    // Campos de contato - ATUALIZADO: adicionado cellphone, removido whatsapp
    'contact_name': { type: 'contact', realField: 'contact', relationPath: 'contacts.0.contact.contact' },
    'phone': { type: 'contact', realField: 'phone', relationPath: 'contacts.0.contact.phone' },
    'cellphone': { type: 'contact', realField: 'cellphone', relationPath: 'contacts.0.contact.cellphone' }, // ← NOVO CAMPO
    'email': { type: 'contact', realField: 'email', relationPath: 'contacts.0.contact.email' }
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

  static async getOwners(params: GetOwnersParams = {}): Promise<PaginatedOwnerResponse> {
    try {
      console.log('🔍 Executando getOwners com params:', JSON.stringify(params, null, 2));
      
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

      // Construir where clause sem busca global
      const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);
      
      // Verificar tipo de ordenação
      const sortField = Object.keys(sortOptions)[0];
      const sortDirection = sortOptions[sortField];
      
      console.log(`🔧 Campo de ordenação: ${sortField} -> ${sortDirection}`);

      let owners: any[] = [];
      let total = 0;

      // Se houver busca ou ordenação por campo relacionado, buscar todos para processar em memória
      const contactRelatedFields = ['city', 'state', 'district', 'street', 'zip_code', 
                                   'contact_name', 'phone', 'cellphone', 'email'];
      
      if (search.trim() || (sortField && sortDirection && contactRelatedFields.includes(sortField))) {
        console.log(`🔄 Processando em memória (busca: ${search.trim()}, ordenação relacionada: ${sortField})`);
        
        // Buscar TODOS os owners para processamento em memória
        const allOwners = await prisma.owner.findMany({
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
            },
            properties: {
              where: { deleted_at: null },
              select: { 
                id: true, 
                title: true 
              }
            },
            leases: {
              where: { deleted_at: null },
              select: { 
                id: true, 
                contract_number: true 
              }
            }
          }
        });

        // Aplicar filtro de busca em memória se houver termo de busca
        let filteredOwners = allOwners;
        if (search.trim()) {
          filteredOwners = this.filterOwnersBySearch(allOwners, search);
        }

        total = filteredOwners.length;

        // Ordenar em memória se necessário
        if (sortField && sortDirection) {
          if (contactRelatedFields.includes(sortField)) {
            // Ordenação por campo relacionado
            owners = this.sortOwnersByRelatedField(filteredOwners, sortField, sortDirection);
          } else if (['name', 'internal_code', 'occupation', 'marital_status', 
                      'cpf', 'cnpj', 'state_registration', 'municipal_registration',
                      'created_at', 'updated_at'].includes(sortField)) {
            // Ordenação por campo direto em memória
            owners = this.sortByDirectField(filteredOwners, sortField, sortDirection);
          }
        } else {
          // Ordenação padrão por data de criação (mais recente primeiro)
          owners = filteredOwners.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        // Aplicar paginação
        owners = owners.slice(skip, skip + take);
      } else {
        // Ordenação normal (por campos diretos) sem busca global
        const orderBy = this.buildOrderBy(sortOptions);
        
        console.log('📊 ORDER BY direto:', JSON.stringify(orderBy, null, 2));
        
        // Buscar com ordenação do Prisma
        const [ownersData, totalCount] = await Promise.all([
          prisma.owner.findMany({
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
              },
              properties: {
                where: { deleted_at: null },
                select: { 
                  id: true, 
                  title: true 
                }
              },
              leases: {
                where: { deleted_at: null },
                select: { 
                  id: true, 
                  contract_number: true 
                }
              }
            }
          }),
          prisma.owner.count({ where })
        ]);

        owners = ownersData;
        total = totalCount;
      }

      console.log(`✅ Encontrados ${owners.length} proprietários, total: ${total}`);

      return {
        data: owners as OwnerWithRelations[],
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Erro em OwnerService.getOwners:', error);
      throw new Error(`Falha ao buscar proprietários: ${error.message}`);
    }
  }

  /**
   * Filtra owners em memória com base no termo de busca - ATUALIZADO para cellphone
   */
  private static filterOwnersBySearch(
    owners: any[],
    searchTerm: string
  ): any[] {
    if (!searchTerm.trim()) return owners;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return owners.filter(owner => {
      // Campos diretos do owner
      const directFields = [
        owner.name,
        owner.internal_code,
        owner.occupation,
        owner.marital_status,
        owner.cpf,
        owner.cnpj,
        owner.state_registration,
        owner.municipal_registration
      ].filter(Boolean).join(' ');

      // Campos de endereço
      const addressFields = owner.addresses
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
      const contactFields = owner.contacts
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

      // Campos diretos do proprietário
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
  private static buildOrderBy(sortOptions: Record<string, 'asc' | 'desc'>): any[] {
    const orderBy: any[] = [];

    Object.entries(sortOptions).forEach(([field, direction]) => {
      if (!direction) return;

      // Apenas campos diretos que o Prisma pode ordenar
      if (['name', 'internal_code', 'occupation', 'marital_status', 
           'cpf', 'cnpj', 'state_registration', 'municipal_registration',
           'created_at', 'updated_at'].includes(field)) {
        orderBy.push({ [field]: direction });
      }
    });

    if (orderBy.length === 0) {
      orderBy.push({ created_at: 'desc' });
    }

    return orderBy;
  }

  /**
   * Ordenação por campo relacionado - ATUALIZADO para cellphone
   */
  private static sortOwnersByRelatedField(
    owners: any[], 
    sortField: string, 
    direction: 'asc' | 'desc'
  ): any[] {
    return [...owners].sort((a, b) => {
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

  static async getOwnerById(id: string): Promise<OwnerWithRelations> {
    try {
      console.log(`🔍 Getting owner by ID: ${id}`);
      
      const owner = await prisma.owner.findUnique({
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
          },
          properties: {
            where: { deleted_at: null },
            include: {
              type: true,
              addresses: {
                where: { deleted_at: null },
                include: { 
                  address: true 
                }
              }
            }
          },
          leases: {
            where: { deleted_at: null },
            include: {
              property: {
                include: {
                  type: true,
                  addresses: {
                    where: { deleted_at: null },
                    include: { 
                      address: true 
                    }
                  }
                }
              },
              tenant: true
            }
          }
        }
      });

      if (!owner) {
        throw new Error('Owner not found');
      }

      console.log(`✅ Found owner: ${owner.name}`);
      return owner as unknown as OwnerWithRelations;

    } catch (error: any) {
      console.error(`❌ Error getting owner ${id}:`, error);
      throw error;
    }
  }

  /**
   * Cria um novo proprietário - ATUALIZADO para cellphone
   */
  static async createOwner(data: CreateOwnerInput): Promise<OwnerWithRelations> {
    try {
      console.log('➕ Creating new owner:', data.name);
      
      // Determinar tipo
      const isPessoaFisica = !!data.cpf;
      const isPessoaJuridica = !!data.cnpj;
      
      const owner = await prisma.$transaction(async (tx: any) => {
        // Verificar CPF único se fornecido (apenas para PF)
        if (isPessoaFisica && data.cpf) {
          const existingCPF = await tx.owner.findFirst({
            where: { 
              cpf: data.cpf,
              deleted_at: null
            }
          });

          if (existingCPF) {
            throw new Error('CPF already registered');
          }
        }

        // Verificar CNPJ único se fornecido (apenas para PJ)
        if (isPessoaJuridica && data.cnpj) {
          const existingCNPJ = await tx.owner.findFirst({
            where: { 
              cnpj: data.cnpj,
              deleted_at: null
            }
          });

          if (existingCNPJ) {
            throw new Error('CNPJ already registered');
          }
        }

        // Preparar dados para criação
        const ownerData: any = {
          name: data.name,
          internal_code: data.internal_code,
        };

        // Adicionar campos baseado no tipo
        if (isPessoaFisica) {
          ownerData.occupation = data.occupation;
          ownerData.marital_status = data.marital_status;
          ownerData.cpf = data.cpf;
          // Limpar campos de PJ
          ownerData.cnpj = null;
          ownerData.state_registration = null;
          ownerData.municipal_registration = null;
        } else if (isPessoaJuridica) {
          ownerData.cnpj = data.cnpj;
          ownerData.state_registration = data.state_registration;
          ownerData.municipal_registration = data.municipal_registration;
          // Limpar campos de PF
          ownerData.occupation = null;
          ownerData.marital_status = null;
          ownerData.cpf = null;
        }

        // Criar proprietário
        const newOwner = await tx.owner.create({
          data: ownerData
        });

        if (data.contacts && data.contacts.length > 0) {
          for (const contact of data.contacts) {
            const newContact = await tx.contact.create({
              data: {
                contact: contact.contact || null,
                phone: contact.phone || null,
                cellphone: contact.cellphone || null,
                email: contact.email || null,
              }
            });

            await tx.ownerContact.create({
              data: {
                owner_id: newOwner.id,
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

            await tx.ownerAddress.create({
              data: {
                owner_id: newOwner.id,
                address_id: newAddress.id
              }
            });
          }
        }

        return newOwner;
      });

      // Buscar o owner criado com relacionamentos
      const createdOwner = await this.getOwnerById(owner.id);
      
      console.log(`✅ Owner created: ${owner.id}`);
      return createdOwner;

    } catch (error: any) {
      console.error('❌ Error creating owner:', error);
      throw error;
    }
  }

  /**
   * Atualiza um proprietário - ATUALIZADO para cellphone
   */
  static async updateOwner(id: string, data: UpdateOwnerInput): Promise<OwnerWithRelations> {
    try {
      console.log(`✏️ Updating owner: ${id}`);
      
      const owner = await prisma.$transaction(async (tx: any) => {
        // Verificar se existe e não está deletado
        const existing = await tx.owner.findUnique({ 
          where: { 
            id,
            deleted_at: null 
          } 
        });
        
        if (!existing) {
          throw new Error('Owner not found');
        }

        // Determinar tipo baseado nos dados existentes ou novos
        const isPessoaFisica = data.cpf || (!data.cnpj && existing.cpf);
        const isPessoaJuridica = data.cnpj || (!data.cpf && existing.cnpj);

        // Verificar CPF único se mudou (apenas para PF)
        if (isPessoaFisica && data.cpf && data.cpf !== existing.cpf) {
          const cpfExists = await tx.owner.findFirst({
            where: { 
              cpf: data.cpf, 
              NOT: { id },
              deleted_at: null
            }
          });
          
          if (cpfExists) {
            throw new Error('CPF already registered for another owner');
          }
        }

        // Verificar CNPJ único se mudou (apenas para PJ)
        if (isPessoaJuridica && data.cnpj && data.cnpj !== existing.cnpj) {
          const cnpjExists = await tx.owner.findFirst({
            where: { 
              cnpj: data.cnpj, 
              NOT: { id },
              deleted_at: null
            }
          });
          
          if (cnpjExists) {
            throw new Error('CNPJ already registered for another owner');
          }
        }

        // Preparar dados para atualização
        const updateData: any = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.internal_code !== undefined) updateData.internal_code = data.internal_code;

        // Atualizar campos baseado no tipo
        if (isPessoaFisica) {
          if (data.occupation !== undefined) updateData.occupation = data.occupation;
          if (data.marital_status !== undefined) updateData.marital_status = data.marital_status;
          if (data.cpf !== undefined) updateData.cpf = data.cpf;
          // Limpar campos de PJ
          updateData.cnpj = null;
          updateData.state_registration = null;
          updateData.municipal_registration = null;
        } else if (isPessoaJuridica) {
          if (data.cnpj !== undefined) updateData.cnpj = data.cnpj;
          if (data.state_registration !== undefined) updateData.state_registration = data.state_registration;
          if (data.municipal_registration !== undefined) updateData.municipal_registration = data.municipal_registration;
          // Limpar campos de PF
          updateData.occupation = null;
          updateData.marital_status = null;
          updateData.cpf = null;
        }

        // Atualizar propriedade
        const updatedOwner = await tx.owner.update({
          where: { id },
          data: updateData
        });

        // Atualizar contatos (substituir todos) se fornecido - ATUALIZADO para cellphone
        if (data.contacts !== undefined) {
          // Soft delete dos contatos existentes
          await tx.ownerContact.updateMany({
            where: { 
              owner_id: id,
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

              await tx.ownerContact.create({
                data: {
                  owner_id: id,
                  contact_id: newContact.id
                }
              });
            }
          }
        }

        // Atualizar endereços (substituir todos) se fornecido
        if (data.addresses !== undefined) {
          // Soft delete dos endereços existentes
          await tx.ownerAddress.updateMany({
            where: { 
              owner_id: id,
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

              await tx.ownerAddress.create({
                data: {
                  owner_id: id,
                  address_id: newAddress.id
                }
              });
            }
          }
        }

        return updatedOwner;
      });

      // Buscar o owner atualizado com relacionamentos
      const updatedOwnerWithRelations = await this.getOwnerById(id);
      
      console.log(`✅ Owner updated: ${owner.id}`);
      return updatedOwnerWithRelations;

    } catch (error: any) {
      console.error(`❌ Error updating owner ${id}:`, error);
      throw error;
    }
  }

  static async deleteOwner(id: string): Promise<OwnerWithRelations> {
    try {
      console.log(`🗑️ Soft deleting owner: ${id}`);
      
      // Verificar se o proprietário existe e não está deletado
      const owner = await prisma.owner.findUnique({
        where: { 
          id,
          deleted_at: null
        },
      });

      if (!owner) {
        throw new Error('Owner not found or already deleted');
      }

      // SOFT DELETE em cascata
      await prisma.$transaction(async (tx: any) => {
        // Soft delete do proprietário
        await tx.owner.update({
          where: { id },
          data: { 
            deleted_at: new Date(),
          },
        });

        // Soft delete dos contatos relacionados
        await tx.ownerContact.updateMany({
          where: { 
            owner_id: id,
            deleted_at: null 
          },
          data: { deleted_at: new Date() }
        });

        // Soft delete dos endereços relacionados
        await tx.ownerAddress.updateMany({
          where: { 
            owner_id: id,
            deleted_at: null 
          },
          data: { deleted_at: new Date() }
        });
      });

      console.log(`✅ Owner soft deleted: ${id}`);
      return owner as OwnerWithRelations;

    } catch (error: any) {
      console.error(`❌ Error soft deleting owner ${id}:`, error);
      throw error;
    }
  }

  static async restoreOwner(id: string): Promise<OwnerWithRelations> {
    try {
      console.log(`♻️ Restoring owner: ${id}`);
      
      // Verificar se o proprietário existe
      const owner = await prisma.owner.findUnique({
        where: { id },
      });

      if (!owner) {
        throw new Error('Owner not found');
      }

      if (!owner.deleted_at) {
        throw new Error('Owner is not deleted');
      }

      // Restaurar em cascata
      await prisma.$transaction(async (tx: any) => {
        // Restaurar proprietário
        await tx.owner.update({
          where: { id },
          data: { 
            deleted_at: null,
          },
        });

        // Restaurar contatos relacionados
        await tx.ownerContact.updateMany({
          where: { owner_id: id },
          data: { deleted_at: null }
        });

        // Restaurar endereços relacionados
        await tx.ownerAddress.updateMany({
          where: { owner_id: id },
          data: { deleted_at: null }
        });
      });

      // Buscar o owner restaurado
      const restoredOwner = await this.getOwnerById(id);
      
      console.log(`✅ Owner restored: ${id}`);
      return restoredOwner;

    } catch (error: any) {
      console.error(`❌ Error restoring owner ${id}:`, error);
      throw error;
    }
  }

  /**
   * Obtém filtros para proprietários - ATUALIZADO para cellphone
   */
  static async getOwnerFilters(filters?: Record<string, any>) {
    try {
      console.log('🔍 Building comprehensive owner filters with context...');
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
        owners,
        addresses,
        contacts,
        dateRange
      ] = await Promise.all([
        // Proprietários
        prisma.owner.findMany({
          where,
          select: {
            name: true,
            internal_code: true,
            occupation: true,
            marital_status: true,
            cpf: true,
            cnpj: true,
            state_registration: true,
            municipal_registration: true
          },
          distinct: ['name', 'internal_code', 'occupation', 'marital_status', 
                     'cpf', 'cnpj', 'state_registration', 'municipal_registration']
        }),
        // Endereços
        prisma.address.findMany({
          where: {
            deleted_at: null,
            ownerAddresses: {
              some: {
                owner: {
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
            ownerContacts: {
              some: {
                owner: {
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
        prisma.owner.aggregate({
          where,
          _min: { created_at: true },
          _max: { created_at: true }
        })
      ]);

      console.log(`📈 Found ${owners.length} owners for filters`);

      // Extrair valores únicos
      const uniqueNames = Array.from(new Set(
        owners.filter(o => o.name).map(o => o.name.trim())
      )).sort();

      const uniqueInternalCodes = Array.from(new Set(
        owners.filter(o => o.internal_code).map(o => o.internal_code.trim())
      )).sort();

      const uniqueOccupations = Array.from(new Set(
        owners.filter(o => o.occupation).map(o => o.occupation?.trim())
      )).sort();

      const uniqueMaritalStatuses = Array.from(new Set(
        owners.filter(o => o.marital_status).map(o => o.marital_status?.trim())
      )).sort();

      const uniqueCpfs = Array.from(new Set(
        owners.filter(o => o.cpf).map(o => o.cpf!.trim())
      )).sort();

      const uniqueCnpjs = Array.from(new Set(
        owners.filter(o => o.cnpj).map(o => o.cnpj!.trim())
      )).sort();

      const uniqueStateRegistrations = Array.from(new Set(
        owners.filter(o => o.state_registration).map(o => o.state_registration!.trim())
      )).sort();

      const uniqueMunicipalRegistrations = Array.from(new Set(
        owners.filter(o => o.municipal_registration).map(o => o.municipal_registration!.trim())
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
          field: 'name',
          type: 'string',
          label: 'Nome',
          description: 'Nome completo do proprietário',
          values: uniqueNames,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'internal_code',
          type: 'string',
          label: 'Código Interno',
          description: 'Código interno do proprietário',
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
          description: 'Inscrição Estadual',
          values: uniqueStateRegistrations,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'municipal_registration',
          type: 'string',
          label: 'Inscrição Municipal',
          description: 'Inscrição Municipal',
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
          'contact_name',
          'phone',
          'cellphone', // ← NOVO CAMPO DE BUSCA
          'email'
        ]
      };

    } catch (error) {
      console.error('❌ Error getting owner filters:', error);
      throw error;
    }
  }
}