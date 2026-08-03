import type { PermissionAction } from '../lib/menuResources';

/** Uma linha da matriz, como trafega na API. */
export interface PermissionRow {
  resource: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_custom_field: boolean;
}

/** Catálogo enviado ao front para montar as linhas. */
export interface ResourceCatalogItem {
  key: string;
  label: string;
  group: string;
  actions: PermissionAction[];
}

/** Permissões resolvidas de um usuário, em memória (cache do guard). */
export type ResolvedPermissions = Map<string, Set<PermissionAction>>;

export interface UpsertPermissionsInput {
  permissions: PermissionRow[];
}
