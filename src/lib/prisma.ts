import { env } from '@/env';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCurrentCompanyId } from './tenantContext';
import { getCurrentAuditActor } from './auditContext';
import { AUDITED_MODELS } from './auditModels';
import { sanitizeRecord, diffRecords, scalarKeysOf } from './auditDiff';

// Modelos que têm company_id e devem ser filtrados/populados por empresa.
// Address, Contact, junction tables, PropertyValue, PropertyIptu,
// PlanningMonth, Company e CompanyBranding são excluídos intencionalmente.
const TENANT_MODELS = new Set([
  'Agency', 'Property', 'PropertyType', 'User', 'UserColumnPreference',
  'Document', 'Owner', 'Tenant', 'Lease', 'FinancialInstitution',
  'Category', 'Subcategory', 'Card', 'Center', 'Supplier',
  'Transaction', 'Invoice', 'RecurringConfig', 'Planning', 'Favorite',
  'UserGroup', 'UserGroupPermission', 'UserAccessSchedule',
  'AuditLog',
]);

/**
 * Grava um AuditLog best-effort após create/update/delete em AUDITED_MODELS.
 * Nunca lança: uma falha ao auditar não pode derrubar a operação de negócio
 * que está sendo auditada.
 */
async function recordAudit(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  model: string | undefined,
  recordId: unknown,
  oldValues: Record<string, unknown> | null = null,
  newValues: Record<string, unknown> | null = null
) {
  if (!model || !AUDITED_MODELS.has(model)) return;

  try {
    const companyId = getCurrentCompanyId();
    const actor = getCurrentAuditActor();

    await prisma.auditLog.create({
      data: {
        company_id: companyId ?? null,
        user_id: actor?.userId ?? null,
        user_name: actor?.userName ?? null,
        user_email: actor?.userEmail ?? null,
        action,
        table_name: model,
        record_id: recordId != null ? String(recordId) : null,
        // Já sanitizados (sanitizeRecord/diffRecords) para serem JSON-safe;
        // o cast é só porque o tipo estrito de Prisma.InputJsonValue não
        // aceita Record<string, unknown> diretamente.
        old_values: (oldValues ?? undefined) as any,
        new_values: (newValues ?? undefined) as any,
        ip: actor?.ip ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] Falha ao gravar log de auditoria:', error);
  }
}

/** Nome da propriedade do client Prisma para um model (ex.: "UserGroup" → "userGroup"). */
function toClientProperty(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Estado do registro antes de um update, para computar o diff depois.
 * Best-effort: se a busca falhar, o update prossegue normalmente e o log só
 * fica sem old_values/new_values — nunca bloqueia a operação de negócio.
 */
async function fetchBeforeState(model: string, where: any): Promise<Record<string, any> | null> {
  try {
    const client = (prisma as any)[toClientProperty(model)];
    if (!client?.findFirst) return null;
    return await client.findFirst({ where });
  } catch (error) {
    console.error('[audit] Falha ao buscar estado anterior:', error);
    return null;
  }
}

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
          const result = await query(injectCreate(model, args));
          if (model && AUDITED_MODELS.has(model)) {
            const newValues = sanitizeRecord(model, result);
            await recordAudit('CREATE', model, result?.id, null, newValues);
          }
          return result;
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
        // Sem injeção de company_id aqui de propósito — ver tenant-scoping-gotcha:
        // update/delete não eram interceptados antes desta extensão adicionar o
        // hook de auditoria, e mudar esse comportamento agora alteraria a
        // semântica de segurança de todos os services existentes sem que essa
        // tarefa tenha pedido isso. O único efeito colateral novo é o log.
        async update({ model, args, query }: any) {
          // Estado antes, buscado ANTES de rodar o update — é a única chance
          // de ver o valor antigo, já que a query abaixo já sobrescreve.
          const shouldAudit = model && AUDITED_MODELS.has(model);
          const before = shouldAudit && args?.where
            ? await fetchBeforeState(model, args.where)
            : null;

          const result = await query(args);

          if (shouldAudit) {
            // Todo "excluir" deste sistema é soft delete: um update que grava
            // deleted_at. Sem esse tratamento, a auditoria mostraria "Alteração"
            // para o que o usuário e o critério de aceite chamam de "Exclusão".
            const isSoftDelete = args?.data?.deleted_at != null;
            const touchedKeys = scalarKeysOf(args?.data);
            const { oldValues, newValues } = diffRecords(model, before, result, touchedKeys);

            await recordAudit(
              isSoftDelete ? 'DELETE' : 'UPDATE',
              model,
              result?.id ?? args?.where?.id,
              oldValues,
              newValues
            );
          }

          return result;
        },
        async delete({ model, args, query }: any) {
          const result = await query(args);
          if (model && AUDITED_MODELS.has(model)) {
            // Hard delete: não há "depois" — o registro deixou de existir.
            // O snapshot fica todo em old_values (o que o registro era).
            const oldValues = sanitizeRecord(model, result);
            await recordAudit('DELETE', model, result?.id ?? args?.where?.id, oldValues, null);
          }
          return result;
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
