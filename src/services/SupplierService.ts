import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';

export class SupplierService {
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    return direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
  }

  static async getSuppliers(params: any = {}) {
    try {
      const { limit = 30, page = 1, search = '', filters = {}, sortOptions = {}, includeInactive = false } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where: any = {};
      
      if (!includeInactive) where.deleted_at = null;

      if (search.trim()) {
        where.OR = [
          { legal_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { trade_name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { cnpj: { contains: search, mode: 'insensitive' as Prisma.QueryMode } }
        ];
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          if (['legal_name', 'trade_name', 'cnpj'].includes(key)) {
            where[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
          }
        }
      });

      const orderBy: any[] = [];
      Object.entries(sortOptions).forEach(([field, direction]) => {
        if (['legal_name', 'trade_name', 'cnpj', 'created_at'].includes(field)) {
          orderBy.push({ [field]: this.normalizeSortDirection(direction as string) });
        }
      });
      if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });

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

      return {
        data,
        count,
        totalPages: Math.ceil(count / take),
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

        const newSupplier = await tx.supplier.create({
          data: {
            legal_name: data.legal_name,
            trade_name: data.trade_name,
            cnpj: data.cnpj,
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

        const updatedSupplier = await tx.supplier.update({
          where: { id },
          data: {
            legal_name: data.legal_name,
            trade_name: data.trade_name,
            cnpj: data.cnpj,
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

      // (Se houver futuramente Lançamentos atrelados ao Fornecedor, a validação de bloqueio entra aqui)

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

  static async getSupplierFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      const suppliers = await prisma.supplier.findMany({
        where, select: { legal_name: true, trade_name: true }, distinct: ['legal_name']
      });

      return {
        filters: [
          { field: 'legal_name', type: 'string', label: 'Razão Social', values: [...new Set(suppliers.map(s => s.legal_name))].sort(), searchable: true },
          { field: 'trade_name', type: 'string', label: 'Nome Fantasia', searchable: true }
        ],
        defaultSort: 'created_at:desc',
        searchFields: ['legal_name', 'trade_name', 'cnpj']
      };
    } catch (error) { throw error; }
  }
}