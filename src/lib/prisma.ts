import { env } from '@/env';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCurrentCompanyId } from './tenantContext';

// Modelos que têm company_id e devem ser filtrados por empresa automaticamente.
// Address, Contact, *Address junction tables, PropertyValue, PropertyIptu,
// PlanningMonth, Company e CompanyBranding são excluídos intencionalmente.
const TENANT_MODELS = new Set([
  'Agency', 'Property', 'PropertyType', 'User', 'UserColumnPreference',
  'Document', 'Owner', 'Tenant', 'Lease', 'FinancialInstitution',
  'Category', 'Subcategory', 'Card', 'Center', 'Supplier',
  'Transaction', 'Invoice', 'RecurringConfig', 'Planning', 'Favorite',
]);

function injectCompany(model: string | undefined, args: any) {
  const companyId = getCurrentCompanyId();
  if (!companyId || !model || !TENANT_MODELS.has(model)) return args;
  return {
    ...args,
    where: { company_id: companyId, ...(args?.where ?? {}) },
  };
}

function buildPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }: any) {
          return query(injectCompany(model, args));
        },
        async findFirst({ model, args, query }: any) {
          return query(injectCompany(model, args));
        },
        async count({ model, args, query }: any) {
          return query(injectCompany(model, args));
        },
        async aggregate({ model, args, query }: any) {
          return query(injectCompany(model, args));
        },
        async groupBy({ model, args, query }: any) {
          return query(injectCompany(model, args));
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
