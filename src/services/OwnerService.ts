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
    
    'city': { type: 'address', realField: 'city', relationPath: 'addresses.0.address.city' },
    'state': { type: 'address', realField: 'state', relationPath: 'addresses.0.address.state' },
    'district': { type: 'address', realField: 'district', relationPath: 'addresses.0.address.district' },
    'street': { type: 'address', realField: 'street', relationPath: 'addresses.0.address.street' },
    'zip_code': { type: 'address', realField: 'zip_code', relationPath: 'addresses.0.address.zip_code' },
    'complement': { type: 'address', realField: 'complement', relationPath: 'addresses.0.address.complement' },
    
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
      .replace(/[çÇ]/g, 'c')
      .replace(/[ñÑ]/g, 'n')
      .toLowerCase()
      .trim();
  }

  static async getOwners(params: GetOwnersParams = {}): Promise<PaginatedOwnerResponse> {
    try {
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

      const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);
      const sortField = Object.keys(sortOptions)[0];
      const sortDirection = sortOptions[sortField];
      
      let owners: any[] = [];
      let total = 0;

      const contactRelatedFields = ['city', 'state', 'district', 'street', 'zip_code', 'complement', 
                                    'contact_name', 'phone', 'cellphone', 'email'];
      
      if (search.trim() || (sortField && sortDirection && contactRelatedFields.includes(sortField))) {
        const allOwners = await prisma.owner.findMany({
          where,
          include: {
            addresses: {
              where: { deleted_at: null },
              include: { address: true }
            },
            contacts: {
              where: { deleted_at: null }
            },
            properties: {
              where: { deleted_at: null },
              select: { id: true, title: true }
            },
            leases: {
              where: { deleted_at: null },
              select: { id: true, contract_number: true }
            }
          }
        });

        let filteredOwners = allOwners;
        if (search.trim()) {
          filteredOwners = this.filterOwnersBySearch(allOwners, search);
        }

        total = filteredOwners.length;

        if (sortField && sortDirection) {
          if (contactRelatedFields.includes(sortField)) {
            owners = this.sortOwnersByRelatedField(filteredOwners, sortField, sortDirection);
          } else if (['name', 'internal_code', 'occupation', 'marital_status', 
                      'cpf', 'cnpj', 'state_registration', 'municipal_registration',
                      'created_at', 'updated_at'].includes(sortField)) {
            owners = this.sortByDirectField(filteredOwners, sortField, sortDirection);
          }
        } else {
          owners = filteredOwners.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        owners = owners.slice(skip, skip + take);
      } else {
        const orderBy = this.buildOrderBy(sortOptions);
        
        const [ownersData, totalCount] = await Promise.all([
          prisma.owner.findMany({
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
              },
              properties: {
                where: { deleted_at: null },
                select: { id: true, title: true }
              },
              leases: {
                where: { deleted_at: null },
                select: { id: true, contract_number: true }
              }
            }
          }),
          prisma.owner.count({ where })
        ]);

        owners = ownersData;
        total = totalCount;
      }

      return {
        data: owners as OwnerWithRelations[],
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar proprietários: ${error.message}`);
    }
  }

  private static filterOwnersBySearch(owners: any[], searchTerm: string): any[] {
    if (!searchTerm.trim()) return owners;
    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return owners.filter(owner => {
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

      const addressFields = owner.addresses
        ?.map((ta: any) => ta.address)
        .filter(Boolean)
        .map((addr: any) => [
          addr.street,
          addr.district,
          addr.city,
          addr.state,
          addr.zip_code,
          addr.complement
        ].filter(Boolean).join(' '))
        .join(' ') || '';

      const contactFields = owner.contacts
        ?.filter(Boolean)
        .map((contact: any) => [
          contact.contact,
          contact.phone,
          contact.cellphone,
          contact.email
        ].filter(Boolean).join(' '))
        .join(' ') || '';

      const allFields = [directFields, addressFields, contactFields].join(' ');
      const normalizedAllFields = this.normalizeText(allFields);
      return normalizedAllFields.includes(normalizedSearchTerm);
    });
  }

  private static sortByDirectField(items: any[], field: string, direction: 'asc' | 'desc'): any[] {
    return [...items].sort((a, b) => {
      const valueA = a[field] || '';
      const valueB = b[field] || '';
      const strA = this.normalizeText(String(valueA));
      const strB = this.normalizeText(String(valueB));

      return direction === 'asc' 
        ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' })
        : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
    });
  }

  private static buildWhereClauseWithoutSearch(filters: Record<string, any>, includeInactive: boolean): any {
    const where: any = {};
    if (!includeInactive) where.deleted_at = null;
    const filterConditions = this.buildFilterConditions(filters);
    if (Object.keys(filterConditions).length > 0) where.AND = [filterConditions];
    return where;
  }

  private static buildFilterConditions(filters: Record<string, any>): any {
    const conditions: any = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      if (['name', 'internal_code', 'occupation', 'marital_status', 
           'cpf', 'cnpj', 'state_registration', 'municipal_registration'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (['city', 'state', 'district', 'street', 'zip_code', 'complement'].includes(key)) {
        if (!conditions.addresses) conditions.addresses = { some: { address: {} } };
        conditions.addresses.some.address[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (key === 'contact_name') {
        if (!conditions.contacts) conditions.contacts = { some: {} };
        conditions.contacts.some.contact = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (['phone', 'cellphone', 'email'].includes(key)) {
        if (!conditions.contacts) conditions.contacts = { some: {} };
        conditions.contacts.some[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
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

  private static buildOrderBy(sortOptions: Record<string, 'asc' | 'desc'>): any[] {
    const orderBy: any[] = [];
    Object.entries(sortOptions).forEach(([field, direction]) => {
      if (!direction) return;
      if (['name', 'internal_code', 'occupation', 'marital_status', 
           'cpf', 'cnpj', 'state_registration', 'municipal_registration',
           'created_at', 'updated_at'].includes(field)) {
        orderBy.push({ [field]: direction });
      }
    });
    if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
    return orderBy;
  }

  private static sortOwnersByRelatedField(owners: any[], sortField: string, direction: 'asc' | 'desc'): any[] {
    return [...owners].sort((a, b) => {
      let valueA = '';
      let valueB = '';

      if (['city', 'state', 'district', 'street', 'zip_code', 'complement'].includes(sortField)) {
        valueA = a.addresses?.[0]?.address?.[sortField] || '';
        valueB = b.addresses?.[0]?.address?.[sortField] || '';
      }
      else if (sortField === 'contact_name') {
        valueA = a.contacts?.[0]?.contact || '';
        valueB = b.contacts?.[0]?.contact || '';
      }
      else if (['phone', 'cellphone', 'email'].includes(sortField)) {
        valueA = a.contacts?.[0]?.[sortField] || '';
        valueB = b.contacts?.[0]?.[sortField] || '';
      }

      const strA = this.normalizeText(String(valueA));
      const strB = this.normalizeText(String(valueB));

      return direction === 'asc' 
        ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' })
        : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
    });
  }

  static async getOwnerById(id: string): Promise<OwnerWithRelations> {
    try {
      const owner = await prisma.owner.findUnique({
        where: { id, deleted_at: null },
        include: {
          addresses: {
            where: { deleted_at: null },
            include: { address: true }
          },
          contacts: {
            where: { deleted_at: null }
          },
          properties: {
            where: { deleted_at: null },
            include: {
              type: true,
              addresses: {
                where: { deleted_at: null },
                include: { address: true }
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
                    include: { address: true }
                  }
                }
              },
              tenant: true
            }
          }
        }
      });

      if (!owner) throw new Error('Owner not found');
      return owner as unknown as OwnerWithRelations;

    } catch (error: any) {
      throw error;
    }
  }

  static async createOwner(data: CreateOwnerInput): Promise<OwnerWithRelations> {
    try {
      const isPessoaFisica = !!data.cpf;
      const isPessoaJuridica = !!data.cnpj;
      
      const owner = await prisma.$transaction(async (tx: any) => {

        if (data.internal_code) {
          const existingInternalCode = await tx.owner.findFirst({
            where: { internal_code: data.internal_code, deleted_at: null }
          });
          if (existingInternalCode) throw new Error('Internal code already registered');
        }

        if (isPessoaFisica && data.cpf) {
          const existingCPF = await tx.owner.findFirst({
            where: { cpf: data.cpf, deleted_at: null }
          });
          if (existingCPF) throw new Error('CPF already registered');
        }

        if (isPessoaJuridica && data.cnpj) {
          const existingCNPJ = await tx.owner.findFirst({
            where: { cnpj: data.cnpj, deleted_at: null }
          });
          if (existingCNPJ) throw new Error('CNPJ already registered');
        }

        const ownerData: any = {
          name: data.name,
          internal_code: data.internal_code,
        };

        if (isPessoaFisica) {
          ownerData.occupation = data.occupation;
          ownerData.marital_status = data.marital_status;
          ownerData.cpf = data.cpf;
          ownerData.cnpj = null;
          ownerData.state_registration = null;
          ownerData.municipal_registration = null;
        } else if (isPessoaJuridica) {
          ownerData.cnpj = data.cnpj;
          ownerData.state_registration = data.state_registration;
          ownerData.municipal_registration = data.municipal_registration;
          ownerData.occupation = null;
          ownerData.marital_status = null;
          ownerData.cpf = null;
        }

        const newOwner = await tx.owner.create({ data: ownerData });

        if (data.contacts && data.contacts.length > 0) {
          for (const contact of data.contacts) {
            await tx.contact.create({
              data: {
                contact: contact.contact || null,
                phone: contact.phone || null,
                cellphone: contact.cellphone || null,
                email: contact.email || null,
                owner_id: newOwner.id
              }
            });
          }
        }

        if (data.addresses && data.addresses.length > 0) {
          for (const address of data.addresses) {
            const newAddress = await tx.address.create({
              data: {
                zip_code: address.zip_code,
                street: address.street,
                number: address.number,
                complement: address.complement || null,
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

      const createdOwner = await this.getOwnerById(owner.id);
      return createdOwner;

    } catch (error: any) {
      throw error;
    }
  }

  static async updateOwner(id: string, data: UpdateOwnerInput): Promise<OwnerWithRelations> {
    try {
      await prisma.$transaction(async (tx: any) => {
        const existing = await tx.owner.findUnique({ 
          where: { id, deleted_at: null } 
        });
        
        if (!existing) throw new Error('Owner not found');

        const isPessoaFisica = data.cpf || (!data.cnpj && existing.cpf);
        const isPessoaJuridica = data.cnpj || (!data.cpf && existing.cnpj);

        if (data.internal_code !== undefined && data.internal_code !== existing.internal_code) {
          const internalCodeExists = await tx.owner.findFirst({
            where: { internal_code: data.internal_code, NOT: { id }, deleted_at: null }
          });
          if (internalCodeExists) throw new Error('Internal code already registered for another owner');
        }

        if (isPessoaFisica && data.cpf && data.cpf !== existing.cpf) {
          const cpfExists = await tx.owner.findFirst({
            where: { cpf: data.cpf, NOT: { id }, deleted_at: null }
          });
          if (cpfExists) throw new Error('CPF already registered for another owner');
        }

        if (isPessoaJuridica && data.cnpj && data.cnpj !== existing.cnpj) {
          const cnpjExists = await tx.owner.findFirst({
            where: { cnpj: data.cnpj, NOT: { id }, deleted_at: null }
          });
          if (cnpjExists) throw new Error('CNPJ already registered for another owner');
        }

        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.internal_code !== undefined) updateData.internal_code = data.internal_code;

        if (isPessoaFisica) {
          if (data.occupation !== undefined) updateData.occupation = data.occupation;
          if (data.marital_status !== undefined) updateData.marital_status = data.marital_status;
          if (data.cpf !== undefined) updateData.cpf = data.cpf;
          updateData.cnpj = null;
          updateData.state_registration = null;
          updateData.municipal_registration = null;
        } else if (isPessoaJuridica) {
          if (data.cnpj !== undefined) updateData.cnpj = data.cnpj;
          if (data.state_registration !== undefined) updateData.state_registration = data.state_registration;
          if (data.municipal_registration !== undefined) updateData.municipal_registration = data.municipal_registration;
          updateData.occupation = null;
          updateData.marital_status = null;
          updateData.cpf = null;
        }

        await tx.owner.update({
          where: { id },
          data: updateData
        });

        if (data.contacts !== undefined) {
          await tx.contact.updateMany({
            where: { owner_id: id, deleted_at: null },
            data: { deleted_at: new Date() }
          });

          if (data.contacts && data.contacts.length > 0) {
            for (const contact of data.contacts) {
              await tx.contact.create({
                data: {
                  contact: contact.contact || null,
                  phone: contact.phone || null,
                  cellphone: contact.cellphone || null,
                  email: contact.email || null,
                  owner_id: id
                }
              });
            }
          }
        }

        if (data.addresses !== undefined) {
          await tx.ownerAddress.updateMany({
            where: { owner_id: id, deleted_at: null },
            data: { deleted_at: new Date() }
          });

          if (data.addresses && data.addresses.length > 0) {
            for (const address of data.addresses) {
              const newAddress = await tx.address.create({
                data: {
                  zip_code: address.zip_code,
                  street: address.street,
                  number: address.number,
                  complement: address.complement || null,
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
      });

      return await this.getOwnerById(id);

    } catch (error: any) {
      throw error;
    }
  }

  static async deleteOwner(id: string): Promise<OwnerWithRelations> {
    try {
      const owner = await prisma.owner.findUnique({
        where: { id, deleted_at: null },
      });

      if (!owner) throw new Error('Owner not found or already deleted');

      await prisma.$transaction(async (tx: any) => {
        await tx.owner.update({
          where: { id },
          data: { deleted_at: new Date() },
        });

        await tx.contact.updateMany({
          where: { owner_id: id, deleted_at: null },
          data: { deleted_at: new Date() }
        });

        await tx.ownerAddress.updateMany({
          where: { owner_id: id, deleted_at: null },
          data: { deleted_at: new Date() }
        });
      });

      return owner as OwnerWithRelations;

    } catch (error: any) {
      throw error;
    }
  }

  static async restoreOwner(id: string): Promise<OwnerWithRelations> {
    try {
      const owner = await prisma.owner.findUnique({ where: { id } });

      if (!owner) throw new Error('Owner not found');
      if (!owner.deleted_at) throw new Error('Owner is not deleted');

      await prisma.$transaction(async (tx: any) => {
        await tx.owner.update({
          where: { id },
          data: { deleted_at: null },
        });

        await tx.contact.updateMany({
          where: { owner_id: id },
          data: { deleted_at: null }
        });

        await tx.ownerAddress.updateMany({
          where: { owner_id: id },
          data: { deleted_at: null }
        });
      });

      return await this.getOwnerById(id);

    } catch (error: any) {
      throw error;
    }
  }

  static async getOwnerFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      
      if (filters) {
        const andFilters: any[] = [];
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (['name', 'internal_code', 'occupation', 'marital_status', 
                 'cpf', 'cnpj', 'state_registration', 'municipal_registration'].includes(key)) {
              andFilters.push({
                [key]: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode }
              });
            }
            else if (['city', 'state', 'district', 'street', 'zip_code', 'complement'].includes(key)) {
              andFilters.push({ 
                addresses: { some: { address: { [key]: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } } } } 
              });
            }
            else if (key === 'contact_name') {
              andFilters.push({ 
                contacts: { some: { contact: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } } } 
              });
            }
            else if (['phone', 'cellphone', 'email'].includes(key)) {
              andFilters.push({ 
                contacts: { some: { [key]: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode } } } 
              });
            }
          }
        });
        if (andFilters.length > 0) where.AND = andFilters;
      }

      const [owners, addresses, contacts, dateRange] = await Promise.all([
        prisma.owner.findMany({
          where,
          select: { name: true, internal_code: true, occupation: true, marital_status: true, cpf: true, cnpj: true, state_registration: true, municipal_registration: true },
          distinct: ['name', 'internal_code', 'occupation', 'marital_status', 'cpf', 'cnpj', 'state_registration', 'municipal_registration']
        }),
        prisma.address.findMany({
          where: { deleted_at: null, ownerAddresses: { some: { owner: { deleted_at: null } } } },
          select: { city: true, state: true, district: true, street: true, zip_code: true, complement: true },
          distinct: ['city', 'state', 'district', 'street', 'zip_code', 'complement']
        }),
        prisma.contact.findMany({
          where: { deleted_at: null, owner_id: { not: null }, owner: { deleted_at: null } },
          select: { contact: true, phone: true, cellphone: true, email: true },
          distinct: ['contact', 'phone', 'cellphone', 'email']
        }),
        prisma.owner.aggregate({
          where,
          _min: { created_at: true },
          _max: { created_at: true }
        })
      ]);

      const filtersList = [
        { field: 'name', type: 'string', label: 'Nome', values: [...new Set(owners.filter(o => o.name).map(o => o.name))].sort(), searchable: true },
        { field: 'internal_code', type: 'string', label: 'Código Interno', values: [...new Set(owners.filter(o => o.internal_code).map(o => o.internal_code))].sort(), searchable: true },
        { field: 'occupation', type: 'string', label: 'Profissão', values: [...new Set(owners.filter(o => o.occupation).map(o => o.occupation))].sort(), searchable: true },
        { field: 'marital_status', type: 'string', label: 'Estado Civil', values: [...new Set(owners.filter(o => o.marital_status).map(o => o.marital_status))].sort(), searchable: true },
        { field: 'cpf', type: 'string', label: 'CPF', values: [...new Set(owners.filter(o => o.cpf).map(o => o.cpf))].sort(), searchable: true },
        { field: 'cnpj', type: 'string', label: 'CNPJ', values: [...new Set(owners.filter(o => o.cnpj).map(o => o.cnpj))].sort(), searchable: true },
        { field: 'state_registration', type: 'string', label: 'Inscrição Estadual', values: [...new Set(owners.filter(o => o.state_registration).map(o => o.state_registration))].sort(), searchable: true },
        { field: 'municipal_registration', type: 'string', label: 'Inscrição Municipal', values: [...new Set(owners.filter(o => o.municipal_registration).map(o => o.municipal_registration))].sort(), searchable: true },
        { field: 'created_at', type: 'date', label: 'Criado em', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true },
        { field: 'city', type: 'string', label: 'Cidade', values: [...new Set(addresses.filter(a => a.city).map(a => a.city))].sort(), searchable: true },
        { field: 'state', type: 'string', label: 'Estado', values: [...new Set(addresses.filter(a => a.state).map(a => a.state))].sort(), searchable: true },
        { field: 'district', type: 'string', label: 'Bairro', values: [...new Set(addresses.filter(a => a.district).map(a => a.district))].sort(), searchable: true },
        { field: 'street', type: 'string', label: 'Rua', values: [...new Set(addresses.filter(a => a.street).map(a => a.street))].sort(), searchable: true },
        { field: 'zip_code', type: 'string', label: 'CEP', values: [...new Set(addresses.filter(a => a.zip_code).map(a => a.zip_code))].sort(), searchable: true },
        { field: 'complement', type: 'string', label: 'Complemento', values: [...new Set(addresses.filter(a => a.complement).map(a => a.complement))].sort(), searchable: true },
        { field: 'contact_name', type: 'string', label: 'Nome do Contato', values: [...new Set(contacts.filter(c => c.contact).map(c => c.contact))].sort(), searchable: true },
        { field: 'phone', type: 'string', label: 'Telefone', values: [...new Set(contacts.filter(c => c.phone).map(c => c.phone))].sort(), searchable: true },
        { field: 'cellphone', type: 'string', label: 'Celular', values: [...new Set(contacts.filter(c => c.cellphone).map(c => c.cellphone))].sort(), searchable: true },
        { field: 'email', type: 'string', label: 'E-mail', values: [...new Set(contacts.filter(c => c.email).map(c => c.email))].sort(), searchable: true }
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
        searchFields: ['name', 'internal_code', 'cpf', 'cnpj', 'state_registration', 'municipal_registration', 'occupation', 'marital_status', 'city', 'state', 'district', 'street', 'zip_code', 'complement', 'contact_name', 'phone', 'cellphone', 'email']
      };

    } catch (error) {
      throw error;
    }
  }

  static async getAvailableContacts(search: string = ''): Promise<any[]> {
    try {
      const where: any = {
        deleted_at: null,
      };

      if (search.trim()) {
        const normalizedSearch = this.normalizeText(search);
        where.OR = [
          { contact: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { cellphone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const contacts = await prisma.contact.findMany({
        where,
        select: {
          id: true,
          contact: true,
          phone: true,
          cellphone: true,
          email: true,
          owner_id: true 
        },
        take: 50,
        orderBy: { created_at: 'desc' }
      });

      const uniqueContacts = new Map();

      contacts.forEach(c => {
        const key = c.cellphone || c.phone || c.email;
        
        if (key && !uniqueContacts.has(key)) {
          uniqueContacts.set(key, {
            contact: c.contact,
            phone: c.phone,
            cellphone: c.cellphone,
            email: c.email
          });
        }
      });

      return Array.from(uniqueContacts.values());

    } catch (error: any) {
      throw new Error(`Falha ao buscar sugestões de contatos: ${error.message}`);
    }
  }
}