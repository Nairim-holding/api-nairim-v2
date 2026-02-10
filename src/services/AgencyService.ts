import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class AgencyService {
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
    
    'city': { type: 'address', realField: 'city', relationPath: 'addresses.0.address.city' },
    'state': { type: 'address', realField: 'state', relationPath: 'addresses.0.address.state' },
    'district': { type: 'address', realField: 'district', relationPath: 'addresses.0.address.district' },
    'street': { type: 'address', realField: 'street', relationPath: 'addresses.0.address.street' },
    'zip_code': { type: 'address', realField: 'zip_code', relationPath: 'addresses.0.address.zip_code' },
    
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

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  private static safeGetProperty<T>(obj: any, path: string): T | undefined {
    return path.split('.').reduce((acc, part) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[part];
    }, obj);
  }

  static async getAgencies(params: any = {}) {
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
      
      const sortEntries = Object.entries(sortOptions) as any;
      const sortField = sortEntries.length > 0 ? sortEntries[0][0] : '';
      const sortDirection = sortEntries.length > 0 ? 
        this.normalizeSortDirection(sortEntries[0][1]) : 'asc';
      
      let agencies: any[] = [];
      let total = 0;

      const contactRelatedFields = ['city', 'state', 'district', 'street', 'zip_code', 
                                   'contact_name', 'phone', 'cellphone', 'email'];
      
      if (search.trim() || (sortField && sortDirection && contactRelatedFields.includes(sortField))) {
        
        const allAgencies = await prisma.agency.findMany({
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
        });

        let filteredAgencies = allAgencies;
        if (search.trim()) {
          filteredAgencies = this.filterAgenciesBySearch(allAgencies, search);
        }

        total = filteredAgencies.length;

        if (sortField && sortDirection) {
          if (contactRelatedFields.includes(sortField)) {
            agencies = this.sortAgenciesByRelatedField(filteredAgencies, sortField, sortDirection);
          } else if (['trade_name', 'legal_name', 'cnpj', 'state_registration', 
                      'municipal_registration', 'license_number', 'created_at', 'updated_at'].includes(sortField)) {
            agencies = this.sortByDirectField(filteredAgencies, sortField, sortDirection);
          }
        } else {
          agencies = filteredAgencies.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        agencies = agencies.slice(skip, skip + take);
      } else {
        const orderBy = this.buildOrderBy(sortOptions);
        
        const [agenciesData, totalCount] = await Promise.all([
          prisma.agency.findMany({
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
          prisma.agency.count({ where })
        ]);

        agencies = agenciesData;
        total = totalCount;
      }

      return {
        data: agencies,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar agências: ${error.message}`);
    }
  }

  private static filterAgenciesBySearch(agencies: any[], searchTerm: string): any[] {
    if (!searchTerm.trim()) return agencies;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return agencies.filter(agency => {
      const directFields = [
        agency.trade_name,
        agency.legal_name,
        agency.cnpj,
        agency.state_registration,
        agency.municipal_registration,
        agency.license_number
      ].filter(Boolean).join(' ');

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

      const contactFields = agency.contacts
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

      if (['trade_name', 'legal_name', 'cnpj', 'state_registration', 
           'municipal_registration', 'license_number'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (['city', 'state', 'district', 'street', 'zip_code'].includes(key)) {
        if (!conditions.addresses) conditions.addresses = { some: { address: {} } };
        conditions.addresses.some.address[key] = { 
          contains: String(value), mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      else if (key === 'contact_name') {
        if (!conditions.contacts) conditions.contacts = { some: {} };
        conditions.contacts.some.contact = { 
          contains: String(value), mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      else if (['phone', 'cellphone', 'email'].includes(key)) {
        if (!conditions.contacts) conditions.contacts = { some: {} };
        conditions.contacts.some[key] = { 
          contains: String(value), mode: 'insensitive' as Prisma.QueryMode 
        };
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

  private static buildOrderBy(sortOptions: Record<string, string>): any[] {
    const orderBy: any[] = [];
    Object.entries(sortOptions).forEach(([field, direction]) => {
      if (!direction) return;
      const normalizedDirection = this.normalizeSortDirection(direction);
      if (['trade_name', 'legal_name', 'cnpj', 'state_registration', 
           'municipal_registration', 'license_number', 'created_at', 'updated_at'].includes(field)) {
        orderBy.push({ [field]: normalizedDirection });
      }
    });
    if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });
    return orderBy;
  }

  private static sortAgenciesByRelatedField(agencies: any[], sortField: string, direction: 'asc' | 'desc'): any[] {
    return [...agencies].sort((a, b) => {
      let valueA = '';
      let valueB = '';

      if (['city', 'state', 'district', 'street', 'zip_code'].includes(sortField)) {
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

  static async getAgencyById(id: string) {
    try {
      const agency = await prisma.agency.findUnique({
        where: { id, deleted_at: null },
        include: {
          addresses: {
            where: { deleted_at: null },
            include: { address: true }
          },
          contacts: {
            where: { deleted_at: null }
          }
        }
      });

      if (!agency) throw new Error('Agency not found');
      return agency;

    } catch (error: any) {
      throw error;
    }
  }

  static async createAgency(data: any) {
    try {
      const agency = await prisma.$transaction(async (tx: any) => {
        const existing = await tx.agency.findFirst({
          where: { cnpj: data.cnpj, deleted_at: null }
        });

        if (existing) throw new Error('CNPJ already registered');

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

        if (data.contacts && data.contacts.length > 0) {
          for (const contact of data.contacts) {
            await tx.contact.create({
              data: {
                contact: contact.contact || null,
                phone: contact.phone || null,
                cellphone: contact.cellphone || null,
                email: contact.email || null,
                agency_id: newAgency.id
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

      return agency;
    } catch (error: any) {
      throw error;
    }
  }

  static async updateAgency(id: string, data: any) {
    try {
      const agency = await prisma.$transaction(async (tx: any) => {
        const existing = await tx.agency.findUnique({ 
          where: { id, deleted_at: null } 
        });
        
        if (!existing) throw new Error('Agency not found');

        if (data.cnpj && data.cnpj !== existing.cnpj) {
          const cnpjExists = await tx.agency.findFirst({
            where: { cnpj: data.cnpj, NOT: { id }, deleted_at: null }
          });
          if (cnpjExists) throw new Error('CNPJ already registered for another agency');
        }

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

        if (data.contacts !== undefined) {
          await tx.contact.updateMany({
            where: { agency_id: id, deleted_at: null },
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
                  agency_id: id
                }
              });
            }
          }
        }

        if (data.addresses !== undefined) {
          await tx.agencyAddress.updateMany({
            where: { agency_id: id, deleted_at: null },
            data: { deleted_at: new Date() }
          });

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

      return agency;
    } catch (error: any) {
      throw error;
    }
  }

  static async deleteAgency(id: string) {
    try {
      const agency = await prisma.agency.findUnique({
        where: { id, deleted_at: null },
      });

      if (!agency) throw new Error('Agency not found or already deleted');

      await prisma.agency.update({
        where: { id },
        data: { 
          deleted_at: new Date(),
          contacts: {
            updateMany: {
              where: { agency_id: id },
              data: { deleted_at: new Date() }
            }
          }
        },
      });

      return agency;
    } catch (error: any) {
      throw error;
    }
  }

  static async restoreAgency(id: string) {
    try {
      const agency = await prisma.agency.findUnique({ where: { id } });

      if (!agency) throw new Error('Agency not found');
      if (!agency.deleted_at) throw new Error('Agency is not deleted');

      await prisma.agency.update({
        where: { id },
        data: { 
          deleted_at: null,
          contacts: {
            updateMany: {
              where: { agency_id: id },
              data: { deleted_at: null }
            }
          }
        }
      });
      
      return agency;
    } catch (error: any) {
      throw error;
    }
  }

  static async getAgencyFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      
      if (filters) {
        const andFilters: any[] = [];
        
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (['trade_name', 'legal_name', 'cnpj', 'state_registration', 
                 'municipal_registration', 'license_number'].includes(key)) {
              andFilters.push({
                [key]: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode }
              });
            }
            else if (['city', 'state', 'district', 'street', 'zip_code'].includes(key)) {
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

        if (andFilters.length > 0) {
          where.AND = andFilters;
        }
      }

      const [agencies, addresses, contacts, dateRange] = await Promise.all([
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
          distinct: ['trade_name', 'legal_name', 'cnpj', 'state_registration', 'municipal_registration', 'license_number']
        }),
        prisma.address.findMany({
          where: {
            deleted_at: null,
            agencyAddresses: { some: { agency: { deleted_at: null } } }
          },
          select: { city: true, state: true, district: true, street: true, zip_code: true },
          distinct: ['city', 'state', 'district', 'street', 'zip_code']
        }),
        prisma.contact.findMany({
          where: { deleted_at: null, agency_id: { not: null }, agency: { deleted_at: null } },
          select: { contact: true, phone: true, cellphone: true, email: true },
          distinct: ['contact', 'phone', 'cellphone', 'email']
        }),
        prisma.agency.aggregate({
          where,
          _min: { created_at: true },
          _max: { created_at: true }
        })
      ]);

      const filtersList = [
        { field: 'trade_name', type: 'string', label: 'Nome Fantasia', values: [...new Set(agencies.filter(a => a.trade_name).map(a => a.trade_name))].sort(), searchable: true },
        { field: 'legal_name', type: 'string', label: 'Razão Social', values: [...new Set(agencies.filter(a => a.legal_name).map(a => a.legal_name))].sort(), searchable: true },
        { field: 'cnpj', type: 'string', label: 'CNPJ', values: [...new Set(agencies.filter(a => a.cnpj).map(a => a.cnpj))].sort(), searchable: true },
        { field: 'state_registration', type: 'string', label: 'Inscrição Estadual', values: [...new Set(agencies.filter(a => a.state_registration).map(a => a.state_registration))].sort(), searchable: true },
        { field: 'municipal_registration', type: 'string', label: 'Inscrição Municipal', values: [...new Set(agencies.filter(a => a.municipal_registration).map(a => a.municipal_registration))].sort(), searchable: true },
        { field: 'license_number', type: 'string', label: 'Número da Licença', values: [...new Set(agencies.filter(a => a.license_number).map(a => a.license_number))].sort(), searchable: true },
        { field: 'created_at', type: 'date', label: 'Criado em', min: dateRange._min.created_at?.toISOString().split('T')[0], max: dateRange._max.created_at?.toISOString().split('T')[0], dateRange: true },
        { field: 'city', type: 'string', label: 'Cidade', values: [...new Set(addresses.filter(a => a.city).map(a => a.city))].sort(), searchable: true },
        { field: 'state', type: 'string', label: 'Estado', values: [...new Set(addresses.filter(a => a.state).map(a => a.state))].sort(), searchable: true },
        { field: 'district', type: 'string', label: 'Bairro', values: [...new Set(addresses.filter(a => a.district).map(a => a.district))].sort(), searchable: true },
        { field: 'street', type: 'string', label: 'Rua', values: [...new Set(addresses.filter(a => a.street).map(a => a.street))].sort(), searchable: true },
        { field: 'zip_code', type: 'string', label: 'CEP', values: [...new Set(addresses.filter(a => a.zip_code).map(a => a.zip_code))].sort(), searchable: true },
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
        searchFields: ['trade_name', 'legal_name', 'cnpj', 'state_registration', 'municipal_registration', 'license_number', 'city', 'state', 'district', 'street', 'zip_code', 'contact_name', 'phone', 'cellphone', 'email']
      };

    } catch (error) {
      throw error;
    }
  }
}