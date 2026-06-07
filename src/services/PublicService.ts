import prisma from '../lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { getCurrentCompanyId } from '../lib/tenantContext';

export interface PublicListParams {
  limit?: number;
  page?: number;
  search?: string;
}

function paginate(limit = 12, page = 1) {
  const take = Math.max(1, Math.min(limit, 100));
  const skip = (Math.max(1, page) - 1) * take;
  return { take, skip };
}

// Seleção mínima de mídia: apenas imagens (documentos legais/financeiros não são públicos)
const PUBLIC_PROPERTY_SELECT = {
  id: true,
  title: true,
  registration_number: true,
  bedrooms: true,
  bathrooms: true,
  half_bathrooms: true,
  garage_spaces: true,
  area_total: true,
  area_built: true,
  frontage: true,
  furnished: true,
  floor_number: true,
  notes: true,
  created_at: true,
  type: { select: { id: true, description: true } },
  agency: { select: { id: true, trade_name: true } },
  addresses: {
    where: { deleted_at: null },
    select: {
      address: {
        select: {
          street: true,
          number: true,
          district: true,
          city: true,
          state: true,
          country: true,
        },
      },
    },
  },
  documents: {
    where: { deleted_at: null, type: 'IMAGE' as const },
    select: { id: true, file_path: true, description: true, is_featured: true },
  },
  values: {
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' as const },
    take: 1,
    select: {
      status: true,
      rental_value: true,
      sale_value: true,
      condo_fee: true,
      property_tax: true,
    },
  },
} satisfies Prisma.PropertySelect;

export class PublicService {
  static async getProperties(params: PublicListParams & { onlyAvailable?: boolean } = {}) {
    const { limit = 12, page = 1, search = '', onlyAvailable = false } = params;
    const { take, skip } = paginate(limit, page);

    const where: Prisma.PropertyWhereInput = {
      deleted_at: null,
      ...(onlyAvailable ? { values: { some: { status: 'AVAILABLE', deleted_at: null } } } : {}),
      ...(search.trim()
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { addresses: { some: { address: { city: { contains: search, mode: 'insensitive' } } } } },
              { addresses: { some: { address: { district: { contains: search, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        select: PUBLIC_PROPERTY_SELECT,
        orderBy: { created_at: 'desc' },
        take,
        skip,
      }),
      prisma.property.count({ where }),
    ]);

    return {
      items: properties,
      meta: { total, page, limit: take, totalPages: Math.max(1, Math.ceil(total / take)) },
    };
  }

  static async getAvailableProperties(params: PublicListParams = {}) {
    return this.getProperties({ ...params, onlyAvailable: true });
  }

  static async getPropertyById(id: string) {
    const companyId = getCurrentCompanyId();
    if (!companyId) return null;

    return prisma.property.findFirst({
      where: { id, company_id: companyId, deleted_at: null },
      select: PUBLIC_PROPERTY_SELECT,
    });
  }

  static async getOwners(params: PublicListParams = {}) {
    const { limit = 50, page = 1, search = '' } = params;
    const { take, skip } = paginate(limit, page);

    const where: Prisma.OwnerWhereInput = {
      deleted_at: null,
      ...(search.trim() ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [owners, total] = await Promise.all([
      prisma.owner.findMany({
        where,
        select: { id: true, name: true, internal_code: true },
        orderBy: { name: 'asc' },
        take,
        skip,
      }),
      prisma.owner.count({ where }),
    ]);

    return {
      items: owners,
      meta: { total, page, limit: take, totalPages: Math.max(1, Math.ceil(total / take)) },
    };
  }

  static async getPropertyTypes(params: PublicListParams = {}) {
    const { limit = 50, page = 1, search = '' } = params;
    const { take, skip } = paginate(limit, page);

    const where: Prisma.PropertyTypeWhereInput = {
      deleted_at: null,
      ...(search.trim() ? { description: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [types, total] = await Promise.all([
      prisma.propertyType.findMany({
        where,
        select: { id: true, description: true },
        orderBy: { description: 'asc' },
        take,
        skip,
      }),
      prisma.propertyType.count({ where }),
    ]);

    return {
      items: types,
      meta: { total, page, limit: take, totalPages: Math.max(1, Math.ceil(total / take)) },
    };
  }

  static async getAgencies(params: PublicListParams = {}) {
    const { limit = 50, page = 1, search = '' } = params;
    const { take, skip } = paginate(limit, page);

    const where: Prisma.AgencyWhereInput = {
      deleted_at: null,
      ...(search.trim() ? { trade_name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [agencies, total] = await Promise.all([
      prisma.agency.findMany({
        where,
        select: { id: true, trade_name: true },
        orderBy: { trade_name: 'asc' },
        take,
        skip,
      }),
      prisma.agency.count({ where }),
    ]);

    return {
      items: agencies,
      meta: { total, page, limit: take, totalPages: Math.max(1, Math.ceil(total / take)) },
    };
  }
}
