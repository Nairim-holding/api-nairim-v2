import { env } from '@/env';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCurrentCompanyId } from './tenantContext';

// Modelos que têm company_id e devem ser filtrados/populados por empresa.
// Address, Contact, junction tables, PropertyValue, PropertyIptu,
// PlanningMonth, Company e CompanyBranding são excluídos intencionalmente.
const TENANT_MODELS = new Set([
  'Agency', 'Property', 'PropertyType', 'User', 'UserColumnPreference',
  'Document', 'Owner', 'Tenant', 'Lease', 'FinancialInstitution',
  'Category', 'Subcategory', 'Card', 'Center', 'Supplier',
  'Transaction', 'Invoice', 'RecurringConfig', 'Planning', 'Favorite',
]);

/** Injeta company_id no where das queries de leitura. */
function injectRead(model: string | undefined, args: any) {
  const companyId = getCurrentCompanyId();
  if (!companyId || !model || !TENANT_MODELS.has(model)) return args;
  return {
    ...args,
    where: { company_id: companyId, ...(args?.where ?? {}) },
  };
}

/**
 * Injeta company_id no data dos creates.
 *
 * Corrige dois casos comuns de services que não recebem company_id:
 *  1. data sem company_id e sem company relation → injeta company_id como scalar
 *  2. data com company: { connect: { id: undefined } } → substitui pelo scalar
 */
function injectCreate(model: string | undefined, args: any) {
  const companyId = getCurrentCompanyId();
  if (!companyId || !model || !TENANT_MODELS.has(model)) return args;

  const data = args?.data ?? {};

  // Caso 2: connect com id undefined — remove a relation quebrada e usa scalar
  if (data.company?.connect?.id === undefined && data.company !== undefined) {
    const { company: _removed, ...rest } = data;
    return { ...args, data: { ...rest, company_id: companyId } };
  }

  // Caso 1: sem company_id nem relation → injeta scalar
  if (!data.company_id && !data.company) {
    return { ...args, data: { ...data, company_id: companyId } };
  }

  return args;
}

function buildPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        // ─── Leitura ─────────────────────────────────────────────────────────
        async findMany({ model, args, query }: any) {
          return query(injectRead(model, args));
        },
        async findFirst({ model, args, query }: any) {
          return query(injectRead(model, args));
        },
        async count({ model, args, query }: any) {
          return query(injectRead(model, args));
        },
        async aggregate({ model, args, query }: any) {
          return query(injectRead(model, args));
        },
        async groupBy({ model, args, query }: any) {
          return query(injectRead(model, args));
        },
        // ─── Escrita ─────────────────────────────────────────────────────────
        async create({ model, args, query }: any) {
          return query(injectCreate(model, args));
        },
        async createMany({ model, args, query }: any) {
          const companyId = getCurrentCompanyId();
          if (companyId && model && TENANT_MODELS.has(model) && Array.isArray(args?.data)) {
            args = {
              ...args,
              data: args.data.map((item: any) =>
                item.company_id ? item : { ...item, company_id: companyId }
              ),
            };
          }
          return query(args);
        },
      },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof buildPrismaClient>;

const globalForPrisma = global as unknown as { prisma: ExtendedPrisma };

const prisma: ExtendedPrisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
