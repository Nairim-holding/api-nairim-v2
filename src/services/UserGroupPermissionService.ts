// services/UserGroupPermissionService.ts
import prisma from '../lib/prisma';
import { getCurrentCompanyId } from '../lib/tenantContext';
import {
  MENU_RESOURCES,
  ACTION_COLUMN,
  PERMISSION_ACTIONS,
  type PermissionAction,
} from '../lib/menuResources';
import type {
  PermissionRow,
  ResourceCatalogItem,
  ResolvedPermissions,
} from '../types/user-group-permission';

/** Janela do cache. Rede de segurança se a API rodar em mais de uma instância:
 *  a invalidação explícita só limpa a memória da instância local. */
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  /** null = usuário sem grupo → sem restrição (comportamento anterior às diretivas). */
  perms: ResolvedPermissions | null;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

function companyId(): string {
  const id = getCurrentCompanyId();
  if (!id) throw new Error('Company context not found');
  return id;
}

export class UserGroupPermissionService {
  // ─── Cache ─────────────────────────────────────────────────────────────────

  /** Chamado quando as diretivas de um grupo mudam. Flush total: editar diretivas
   *  é ação rara de administrador, e um índice reverso grupo→usuários custaria
   *  mais do que economiza. */
  static invalidateCache() {
    cache.clear();
  }

  static invalidateUser(userId: string) {
    cache.delete(userId);
  }

  // ─── Catálogo ──────────────────────────────────────────────────────────────

  static getResourceCatalog(): ResourceCatalogItem[] {
    return MENU_RESOURCES.map(({ key, label, group, actions }) => ({
      key,
      label,
      group,
      actions,
    }));
  }

  // ─── Leitura da matriz (tela de edição) ────────────────────────────────────

  /**
   * Devolve uma linha por recurso do catálogo, preenchendo com o que está salvo.
   * Recurso sem linha no banco vem todo false — a matriz é sempre completa, o que
   * evita o front ter que reconciliar ausências.
   */
  static async getPermissions(userGroupId: string): Promise<PermissionRow[]> {
    const saved = await prisma.userGroupPermission.findMany({
      where: { user_group_id: userGroupId },
    });

    const byResource = new Map(saved.map((p) => [p.resource, p]));

    return MENU_RESOURCES.map((resource) => {
      const row = byResource.get(resource.key);
      return {
        resource: resource.key,
        can_view: row?.can_view ?? false,
        can_create: row?.can_create ?? false,
        can_edit: row?.can_edit ?? false,
        can_delete: row?.can_delete ?? false,
        can_export: row?.can_export ?? false,
        can_custom_field: row?.can_custom_field ?? false,
      };
    });
  }

  // ─── Escrita da matriz ─────────────────────────────────────────────────────

  /**
   * Substitui a matriz inteira do grupo. Só grava linha que tenha ao menos uma
   * permissão marcada — linha toda desmarcada é ausência, não registro vazio.
   */
  static async upsertPermissions(userGroupId: string, rows: PermissionRow[]) {
    const company_id = companyId();

    // findFirst é escopado por empresa: garante que o grupo é da empresa do usuário
    const group = await prisma.userGroup.findFirst({
      where: { id: userGroupId, deleted_at: null },
      select: { id: true },
    });

    if (!group) {
      throw new Error('User group not found');
    }

    const toPersist = rows
      .filter((r) =>
        PERMISSION_ACTIONS.some((a) => r[ACTION_COLUMN[a] as keyof PermissionRow] === true)
      )
      .map((r) => ({
        company_id,
        user_group_id: userGroupId,
        resource: r.resource,
        can_view: r.can_view === true,
        can_create: r.can_create === true,
        can_edit: r.can_edit === true,
        can_delete: r.can_delete === true,
        can_export: r.can_export === true,
        can_custom_field: r.can_custom_field === true,
      }));

    // Troca atômica. deleteMany/createMany levam company_id explícito porque a
    // extensão do Prisma não intercepta deleteMany.
    await prisma.$transaction(async (tx: any) => {
      await tx.userGroupPermission.deleteMany({
        where: { user_group_id: userGroupId, company_id },
      });

      if (toPersist.length > 0) {
        await tx.userGroupPermission.createMany({ data: toPersist });
      }
    });

    this.invalidateCache();

    console.log(`✅ Diretivas do grupo ${userGroupId}: ${toPersist.length} recurso(s) com permissão`);

    return this.getPermissions(userGroupId);
  }

  // ─── Resolução para o guard ────────────────────────────────────────────────

  /**
   * Permissões efetivas do usuário. `null` significa "sem grupo" → sem restrição.
   * Map vazio significa "tem grupo, mas nenhuma permissão" → nega tudo.
   */
  static async resolveForUser(userId: string): Promise<ResolvedPermissions | null> {
    const hit = cache.get(userId);
    if (hit && hit.expires > Date.now()) {
      return hit.perms;
    }

    // findFirst é escopado por empresa pela extensão do Prisma
    const user = await prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
      select: {
        user_group_id: true,
        group: {
          select: {
            deleted_at: true,
            permissions: true,
          },
        },
      },
    });

    let perms: ResolvedPermissions | null;

    if (!user?.user_group_id || !user.group || user.group.deleted_at) {
      // Sem grupo (ou grupo excluído) → mantém o comportamento anterior
      perms = null;
    } else {
      perms = new Map<string, Set<PermissionAction>>();
      for (const row of user.group.permissions) {
        const granted = new Set<PermissionAction>();
        for (const action of PERMISSION_ACTIONS) {
          if ((row as any)[ACTION_COLUMN[action]] === true) granted.add(action);
        }
        perms.set(row.resource, granted);
      }
    }

    cache.set(userId, { perms, expires: Date.now() + CACHE_TTL_MS });
    return perms;
  }
}
