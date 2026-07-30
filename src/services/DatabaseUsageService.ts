import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';
import { env } from '@/env';

export interface CompanyDatabaseUsage {
  companyId: string;
  companyName: string;
  usedBytes: number;
  usedMb: number;
  quotaMb: number;
  percent: number;
  isCurrent: boolean;
}

export interface DatabaseUsageResult {
  current: CompanyDatabaseUsage | null;
  companies: CompanyDatabaseUsage[];
}

const BYTES_PER_MB = 1024 * 1024;

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Tabelas que carregam company_id — atribuição direta.
 * Todas possuem @@index([company_id]).
 */
const DIRECT_TABLES = [
  'Agency', 'Property', 'PropertyType', 'User', 'UserColumnPreference', 'UserDashboardLayout',
  'Document', 'Owner', 'Tenant', 'Lease', 'Favorite', 'FinancialInstitution', 'Category',
  'Subcategory', 'Card', 'Center', 'Supplier', 'Transaction', 'invoices', 'RecurringConfig',
  'Planning', 'CompanyBranding',
] as const;

/** Tabelas filhas sem company_id — sobem até o dono por uma FK simples. */
const JOINED_TABLES: Array<{ table: string; join: string }> = [
  { table: 'PropertyIptu', join: 'JOIN "Property" p ON p.id = t.property_id' },
  { table: 'PropertyValue', join: 'JOIN "Property" p ON p.id = t.property_id' },
  { table: 'PlanningMonth', join: 'JOIN "Planning" p ON p.id = t.planning_id' },
  { table: 'AgencyAddress', join: 'JOIN "Agency" p ON p.id = t.agency_id' },
  { table: 'PropertyAddress', join: 'JOIN "Property" p ON p.id = t.property_id' },
  { table: 'OwnerAddress', join: 'JOIN "Owner" p ON p.id = t.owner_id' },
  { table: 'TenantAddress', join: 'JOIN "Tenant" p ON p.id = t.tenant_id' },
  { table: 'SupplierAddress', join: 'JOIN "Supplier" p ON p.id = t.supplier_id' },
];

/**
 * Uma única query com UNION ALL cobrindo todas as tabelas do schema.
 *
 * Mede o tamanho LÓGICO (pg_column_size = bytes das linhas da empresa), não o
 * físico. O físico (pg_total_relation_size) inclui índices e principalmente
 * *bloat* — espaço morto de updates que o VACUUM ainda não recuperou — que não
 * é dado do cliente: uma tabela com 1 linha pode ocupar vários MB. Usar o
 * físico faria a cota oscilar sozinha a cada VACUUM.
 *
 * Somente leitura: apenas SELECT e funções de catálogo.
 */
function buildUsageQuery(): string {
  const parts: string[] = [];

  for (const table of DIRECT_TABLES) {
    parts.push(
      `SELECT t.company_id AS company_id, SUM(pg_column_size(t.*))::bigint AS bytes
         FROM "${table}" t GROUP BY t.company_id`,
    );
  }

  for (const { table, join } of JOINED_TABLES) {
    parts.push(
      `SELECT p.company_id AS company_id, SUM(pg_column_size(t.*))::bigint AS bytes
         FROM "${table}" t ${join} GROUP BY p.company_id`,
    );
  }

  // Contact aponta para quatro donos possíveis, um por vez.
  parts.push(
    `SELECT COALESCE(a.company_id, o.company_id, te.company_id, s.company_id) AS company_id,
            SUM(pg_column_size(t.*))::bigint AS bytes
       FROM "Contact" t
       LEFT JOIN "Agency"   a  ON a.id  = t.agency_id
       LEFT JOIN "Owner"    o  ON o.id  = t.owner_id
       LEFT JOIN "Tenant"   te ON te.id = t.tenant_id
       LEFT JOIN "Supplier" s  ON s.id  = t.supplier_id
      GROUP BY 1`,
  );

  // Address não tem FK para o dono: chega pelas tabelas de junção. O DISTINCT ON
  // evita contar duas vezes o endereço referenciado por mais de um dono.
  parts.push(
    `SELECT owned.company_id AS company_id, SUM(owned.bytes)::bigint AS bytes
       FROM (
         SELECT DISTINCT ON (a.id) a.id, j.company_id, pg_column_size(a.*) AS bytes
           FROM "Address" a
           JOIN (
             SELECT aa.address_id, ag.company_id FROM "AgencyAddress"   aa JOIN "Agency"   ag ON ag.id = aa.agency_id
             UNION ALL
             SELECT pa.address_id, pr.company_id FROM "PropertyAddress" pa JOIN "Property" pr ON pr.id = pa.property_id
             UNION ALL
             SELECT oa.address_id, ow.company_id FROM "OwnerAddress"    oa JOIN "Owner"    ow ON ow.id = oa.owner_id
             UNION ALL
             SELECT ta.address_id, tn.company_id FROM "TenantAddress"   ta JOIN "Tenant"   tn ON tn.id = ta.tenant_id
             UNION ALL
             SELECT sa.address_id, sp.company_id FROM "SupplierAddress" sa JOIN "Supplier" sp ON sp.id = sa.supplier_id
           ) j ON j.address_id = a.id
       ) owned
      GROUP BY owned.company_id`,
  );

  // A própria linha da empresa.
  parts.push(
    `SELECT t.id AS company_id, pg_column_size(t.*)::bigint AS bytes FROM "Company" t`,
  );

  return parts.join('\nUNION ALL\n');
}

const USAGE_QUERY = buildUsageQuery();

/**
 * Cache global (não por empresa): a query já devolve todas as empresas de uma
 * vez, então uma execução serve qualquer requisição dentro do TTL. TTL curto
 * para o número continuar sendo "tempo real" na prática.
 */
const CACHE_TTL_MS = 30 * 1000;
let cache: { rows: UsageRow[]; fetchedAt: number } | null = null;
let inFlight: Promise<UsageRow[]> | null = null;

interface UsageRow {
  company_id: string | null;
  bytes: bigint | number | null;
}

export function invalidateDatabaseUsageCache(): void {
  cache = null;
}

async function getUsageRows(forceRefresh: boolean): Promise<UsageRow[]> {
  if (forceRefresh) cache = null;

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rows;
  }

  if (!inFlight) {
    inFlight = prisma
      .$queryRaw<UsageRow[]>(Prisma.raw(USAGE_QUERY))
      .then((rows) => {
        cache = { rows, fetchedAt: Date.now() };
        return rows;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

export class DatabaseUsageService {
  /**
   * Consumo de banco por empresa, no formato usado/contratado.
   *
   * O gauge mostra `current` (empresa em contexto); `companies` alimenta o
   * "Ver Dados Detalhados" com o comparativo.
   */
  static async getDatabaseUsage(companyId: string, forceRefresh = false): Promise<DatabaseUsageResult> {
    const [rows, companies] = await Promise.all([
      getUsageRows(forceRefresh),
      // Company não é tenant model — a extensão do Prisma não injeta filtro aqui.
      prisma.company.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true, db_quota_mb: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const bytesByCompany = new Map<string, number>();
    for (const row of rows) {
      if (!row.company_id) continue; // órfão: sem dono identificável
      const bytes = Number(row.bytes ?? 0);
      bytesByCompany.set(row.company_id, (bytesByCompany.get(row.company_id) ?? 0) + bytes);
    }

    const usage: CompanyDatabaseUsage[] = companies.map((company) => {
      const usedBytes = bytesByCompany.get(company.id) ?? 0;
      const usedMb = usedBytes / BYTES_PER_MB;
      const quotaMb = company.db_quota_mb ?? env.DEFAULT_DB_QUOTA_MB;

      return {
        companyId: company.id,
        companyName: company.name,
        usedBytes,
        usedMb: round2(usedMb),
        quotaMb,
        percent: quotaMb > 0 ? round2((usedMb / quotaMb) * 100) : 0,
        isCurrent: company.id === companyId,
      };
    });

    return {
      current: usage.find((item) => item.isCurrent) ?? null,
      companies: usage,
    };
  }
}
