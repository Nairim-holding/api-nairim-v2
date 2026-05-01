import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class SupplierService {
  static readonly FIELD_MAPPING: Record<string, { 
    type: 'direct' | 'address' | 'contact', 
    realField: string,
    relationPath?: string 
  }> = {
    'legal_name': { type: 'direct', realField: 'legal_name' },
    'trade_name': { type: 'direct', realField: 'trade_name' },
    'cnpj': { type: 'direct', realField: 'cnpj' },
    'cpf': { type: 'direct', realField: 'cpf' }, // <-- ADICIONADO
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
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  private static safeGetProperty(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
  }

  private static filterSuppliersBySearch(suppliers: any[], searchTerm: string): any[] {
    if (!searchTerm.trim()) return suppliers;
    const normalizedSearch = this.normalizeText(searchTerm);

    return suppliers.filter(supplier => {
      const directFields = [
        supplier.legal_name,
        supplier.trade_name,
        supplier.cnpj,
        supplier.cpf, // <-- ADICIONADO
        supplier.state_registration,
        supplier.municipal_registration
      ].filter(Boolean).join(' ');

      const addressFields = supplier.addresses
        ?.map((sa: any) => sa.address)
        .filter(Boolean)
        .map((addr: any) => [addr.street, addr.district, addr.city, addr.state, addr.zip_code, addr.complement].filter(Boolean).join(' '))
        .join(' ') || '';

      const contactFields = supplier.contacts
        ?.map((c: any) => [c.contact, c.phone, c.cellphone, c.email].filter(Boolean).join(' '))
        .join(' ') || '';

      const allFields = [directFields, addressFields, contactFields].join(' ');
      return this.normalizeText(allFields).includes(normalizedSearch);
    });
  }

  private static buildFilterConditions(filters: Record<string, any>): any {
    const conditions: any = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      if (['legal_name', 'trade_name', 'cnpj', 'cpf', 'state_registration', 'municipal_registration'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' };
      }
      else if (['city', 'state', 'zip_code', 'street', 'district', 'complement'].includes(key)) {
        if (!conditions.addresses) conditions.addresses = { some: { address: {} } };
        conditions.addresses.some.address[key] = { contains: String(value), mode: 'insensitive' };
      }
      else if (key === 'contact_name') {
        if (!conditions.contacts) conditions.contacts = { some: {} };
        conditions.contacts.some.contact = { contains: String(value), mode: 'insensitive' };
      }
      else if (['phone', 'cellphone', 'email'].includes(key)) {
        if (!conditions.contacts) conditions.contacts = { some: {} };
        conditions.contacts.some[key] = { contains: String(value), mode: 'insensitive' };
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
        const start = new Date(date); start.setHours(0,0,0,0);
        const end = new Date(date); end.setHours(23,59,59,999);
        return { gte: start, lte: end };
      }
    }
    return {};
  }

  static async getSuppliers(params: any = {}) {
    try {
      const { limit = 30, page = 1, search = '', filters = {}, sortOptions = {}, includeInactive = false } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where: any = {};
      if (!includeInactive) where.deleted_at = null;

      const filterConditions = this.buildFilterConditions(filters);
      if (Object.keys(filterConditions).length > 0) {
        where.AND = [filterConditions];
      }

      const sortField = Object.keys(sortOptions)[0];
      const sortDirection = sortField ? this.normalizeSortDirection(sortOptions[sortField]) : 'desc';

      const contactRelatedFields = ['city', 'state', 'district', 'street', 'zip_code', 'complement', 'contact_name', 'phone', 'cellphone', 'email'];

      let suppliersData: any[] = [];
      let total = 0;

      if (search.trim() || (sortField && contactRelatedFields.includes(sortField))) {
        const allSuppliers = await prisma.supplier.findMany({ 
          where,
          include: { 
            addresses: { where: { deleted_at: null }, include: { address: true } },
            contacts: { where: { deleted_at: null } }
          }
        });

        let filtered = this.filterSuppliersBySearch(allSuppliers, search);
        total = filtered.length;

        if (sortField) {
          filtered = filtered.sort((a, b) => {
             const fieldInfo = this.FIELD_MAPPING[sortField];
             let valA, valB;
             
             if (fieldInfo?.relationPath) {
               valA = this.safeGetProperty(a, fieldInfo.relationPath);
               valB = this.safeGetProperty(b, fieldInfo.relationPath);
             } else {
               valA = a[sortField];
               valB = b[sortField];
             }

             const strA = this.normalizeText(String(valA || ''));
             const strB = this.normalizeText(String(valB || ''));
             return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          });
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        
        suppliersData = filtered.slice(skip, skip + take);

      } else {
        const orderBy: any[] = [];
        if (sortField && ['legal_name', 'trade_name', 'cnpj', 'cpf', 'created_at'].includes(sortField)) {
          orderBy.push({ [sortField]: sortDirection });
        } else {
          orderBy.push({ created_at: 'desc' });
        }

        const [data, count] = await Promise.all([
          prisma.supplier.findMany({ 
            where, skip, take, orderBy,
            include: { 
              addresses: { where: { deleted_at: null }, include: { address: true } },
              contacts: { where: { deleted_at: null } }
            }
          }),
          prisma.supplier.count({ where })
        ]);

        suppliersData = data;
        total = count;
      }

      return {
        data: suppliersData,
        count: total,
        totalPages: Math.ceil(total / take),
        currentPage: page,
      };

    } catch (error: any) {
      throw new Error(`Falha ao buscar fornecedores: ${error.message}`);
    }
  }

  static async getSupplierById(id: string) {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id, deleted_at: null },
        include: {
          addresses: { where: { deleted_at: null }, include: { address: true } },
          contacts: { where: { deleted_at: null } }
        }
      });
      if (!supplier) throw new Error('Supplier not found');
      return supplier;
    } catch (error: any) { throw error; }
  }

  static async createSupplier(data: any) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (data.cnpj) {
          const existing = await tx.supplier.findFirst({ where: { cnpj: data.cnpj, deleted_at: null } });
          if (existing) throw new Error('CNPJ already registered');
        }

        if (data.cpf) { // <-- VERIFICAÇÃO DE CPF ADICIONADA
          const existing = await tx.supplier.findFirst({ where: { cpf: data.cpf, deleted_at: null } });
          if (existing) throw new Error('CPF already registered');
        }

        const newSupplier = await tx.supplier.create({
          data: {
            legal_name: data.legal_name,
            trade_name: data.trade_name,
            cnpj: data.cnpj,
            cpf: data.cpf,
            internal_code: data.internal_code, // <-- NOVO
            occupation: data.occupation,       // <-- NOVO
            marital_status: data.marital_status, // <-- NOVO
            state_registration: data.state_registration,
            municipal_registration: data.municipal_registration,
          }
        });

        if (data.contacts && data.contacts.length > 0) {
          for (const contact of data.contacts) {
            await tx.contact.create({
              data: { ...contact, supplier_id: newSupplier.id }
            });
          }
        }

        if (data.addresses && data.addresses.length > 0) {
          for (const addr of data.addresses) {
            const newAddress = await tx.address.create({ 
              data: { ...addr, country: addr.country || 'Brasil' } 
            });
            await tx.supplierAddress.create({
              data: { supplier_id: newSupplier.id, address_id: newAddress.id }
            });
          }
        }

        return newSupplier;
      });
    } catch (error: any) { throw error; }
  }

  static async updateSupplier(id: string, data: any) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.supplier.findUnique({ where: { id, deleted_at: null } });
        if (!existing) throw new Error('Supplier not found');

        if (data.cnpj && data.cnpj !== existing.cnpj) {
          const cnpjExists = await tx.supplier.findFirst({
            where: { cnpj: data.cnpj, NOT: { id }, deleted_at: null }
          });
          if (cnpjExists) throw new Error('CNPJ already registered for another supplier');
        }

        if (data.cpf && data.cpf !== existing.cpf) { // <-- VERIFICAÇÃO DE CPF ADICIONADA
          const cpfExists = await tx.supplier.findFirst({
            where: { cpf: data.cpf, NOT: { id }, deleted_at: null }
          });
          if (cpfExists) throw new Error('CPF already registered for another supplier');
        }

        const updatedSupplier = await tx.supplier.update({
          where: { id },
          data: {
            legal_name: data.legal_name,
            trade_name: data.trade_name,
            cnpj: data.cnpj,
            cpf: data.cpf,
            internal_code: data.internal_code, // <-- NOVO
            occupation: data.occupation,       // <-- NOVO
            marital_status: data.marital_status, // <-- NOVO
            state_registration: data.state_registration,
            municipal_registration: data.municipal_registration,
          }
        });

        if (data.contacts !== undefined) {
          await tx.contact.updateMany({
            where: { supplier_id: id, deleted_at: null },
            data: { deleted_at: new Date() }
          });

          if (data.contacts && data.contacts.length > 0) {
            for (const contact of data.contacts) {
              await tx.contact.create({ data: { ...contact, supplier_id: id } });
            }
          }
        }

        if (data.addresses !== undefined) {
          await tx.supplierAddress.updateMany({
            where: { supplier_id: id, deleted_at: null },
            data: { deleted_at: new Date() }
          });

          if (data.addresses && data.addresses.length > 0) {
            for (const addr of data.addresses) {
              const newAddress = await tx.address.create({ 
                data: { ...addr, country: addr.country || 'Brasil' } 
              });
              await tx.supplierAddress.create({
                data: { supplier_id: id, address_id: newAddress.id }
              });
            }
          }
        }

        return updatedSupplier;
      });
    } catch (error: any) { throw error; }
  }

  static async deleteSupplier(id: string) {
    try {
      const supplier = await prisma.supplier.findUnique({ where: { id, deleted_at: null } });
      if (!supplier) throw new Error('Supplier not found or already deleted');

      await prisma.supplier.update({
        where: { id },
        data: { 
          deleted_at: new Date(),
          contacts: {
            updateMany: { where: { supplier_id: id }, data: { deleted_at: new Date() } }
          },
          addresses: {
            updateMany: { where: { supplier_id: id }, data: { deleted_at: new Date() } }
          }
        }
      });

      return supplier;
    } catch (error: any) { throw error; }
  }

  static async restoreSupplier(id: string) {
    try {
      const supplier = await prisma.supplier.findUnique({ where: { id } });
      if (!supplier) throw new Error('Supplier not found');
      if (!supplier.deleted_at) throw new Error('Supplier is not deleted');

      return await prisma.supplier.update({
        where: { id },
        data: { 
          deleted_at: null,
          contacts: { updateMany: { where: { supplier_id: id }, data: { deleted_at: null } } },
          addresses: { updateMany: { where: { supplier_id: id }, data: { deleted_at: null } } }
        }
      });
    } catch (error: any) { throw error; }
  }

  static async quickCreate(data: { legal_name: string }) {
    try {
      const legalName = String(data.legal_name ?? '').trim();
      
      // Validação
      if (legalName.length < 2 || legalName.length > 150) {
        throw new Error('legal_name é obrigatório e deve ter entre 2 e 150 caracteres.');
      }
      
      // Verificar duplicidade (idempotência)
      const existing = await prisma.supplier.findFirst({
        where: {
          legal_name: { equals: legalName, mode: 'insensitive' },
          deleted_at: null
        }
      });
      
      if (existing) {
        return existing; // Idempotente - retorna registro existente
      }
      
      // Gerar próximo internal_code
      const lastSupplier = await prisma.supplier.findFirst({
        where: { deleted_at: null },
        orderBy: { internal_code: 'desc' },
        select: { internal_code: true }
      });
      
      let nextInternalCode = '1';
      if (lastSupplier?.internal_code) {
        const lastCode = parseInt(lastSupplier.internal_code.replace(/\D/g, ''));
        if (!isNaN(lastCode)) {
          nextInternalCode = String(lastCode + 1);
        }
      }
      
      // Criar novo fornecedor
      const newSupplier = await prisma.supplier.create({
        data: {
          legal_name: legalName,
          internal_code: nextInternalCode,
          created_via: 'quick_create',
          is_active: true
        }
      });
      
      return newSupplier;
      
    } catch (error: any) {
      throw new Error(`Falha ao criar fornecedor rápido: ${error.message}`);
    }
  }

  static async getSupplierFilters(filters?: Record<string, any>) {
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

      const [suppliers, addresses, contacts, dateRange] = await Promise.all([
        prisma.supplier.findMany({
          where,
          select: { legal_name: true, trade_name: true, cnpj: true, cpf: true, state_registration: true, municipal_registration: true },
          distinct: ['legal_name', 'trade_name', 'cnpj', 'cpf', 'state_registration', 'municipal_registration']
        }),
        prisma.address.findMany({
          where: { deleted_at: null, supplierAddresses: { some: { supplier: { deleted_at: null } } } },
          select: { city: true, state: true, district: true, street: true, zip_code: true, complement: true },
          distinct: ['city', 'state', 'district', 'street', 'zip_code', 'complement']
        }),
        prisma.contact.findMany({
          where: { deleted_at: null, supplier_id: { not: null }, supplier: { deleted_at: null } },
          select: { contact: true, phone: true, cellphone: true, email: true },
          distinct: ['contact', 'phone', 'cellphone', 'email']
        }),
        prisma.supplier.aggregate({
          where,
          _min: { created_at: true },
          _max: { created_at: true }
        })
      ]);

      const filtersList = [
        { field: 'legal_name', type: 'string', label: 'Nome / Razão Social', values: [...new Set(suppliers.map(s => s.legal_name).filter(Boolean))].sort(), searchable: true },
        { field: 'trade_name', type: 'string', label: 'Nome Fantasia', values: [...new Set(suppliers.map(s => s.trade_name).filter(Boolean))].sort(), searchable: true },
        { field: 'cnpj', type: 'string', label: 'CNPJ', values: [...new Set(suppliers.map(s => s.cnpj).filter(Boolean))].sort(), searchable: true },
        { field: 'cpf', type: 'string', label: 'CPF', values: [...new Set(suppliers.map(s => s.cpf).filter(Boolean))].sort(), searchable: true },
        { field: 'state_registration', type: 'string', label: 'Inscrição Estadual', values: [...new Set(suppliers.map(s => s.state_registration).filter(Boolean))].sort(), searchable: true },
        { field: 'municipal_registration', type: 'string', label: 'Inscrição Municipal', values: [...new Set(suppliers.map(s => s.municipal_registration).filter(Boolean))].sort(), searchable: true },
        
        { field: 'city', type: 'string', label: 'Cidade', values: [...new Set(addresses.map(a => a.city).filter(Boolean))].sort(), searchable: true },
        { field: 'state', type: 'string', label: 'Estado', values: [...new Set(addresses.map(a => a.state).filter(Boolean))].sort(), searchable: true },
        { field: 'district', type: 'string', label: 'Bairro', values: [...new Set(addresses.map(a => a.district).filter(Boolean))].sort(), searchable: true },
        { field: 'street', type: 'string', label: 'Rua', values: [...new Set(addresses.map(a => a.street).filter(Boolean))].sort(), searchable: true },
        { field: 'zip_code', type: 'string', label: 'CEP', values: [...new Set(addresses.map(a => a.zip_code).filter(Boolean))].sort(), searchable: true },
        { field: 'complement', type: 'string', label: 'Complemento', values: [...new Set(addresses.map(a => a.complement).filter(Boolean))].sort(), searchable: true },
        
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
        searchFields: ['legal_name', 'trade_name', 'cnpj', 'cpf', 'city', 'state', 'contact_name', 'phone', 'cellphone', 'email']
      };

    } catch (error) {
      throw error;
    }
  }
}