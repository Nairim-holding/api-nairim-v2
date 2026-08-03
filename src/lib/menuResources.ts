/**
 * Catálogo de recursos (itens de menu) sujeitos a diretivas de acesso.
 *
 * Fonte única da verdade: o front monta a matriz a partir de
 * `GET /user-groups/resources`, sem hardcodar a lista. Adicionar recurso é
 * mudança só aqui.
 *
 * `actions` declara quais permissões fazem sentido no recurso — nem toda ação se
 * aplica a todo item (Dashboard só se visualiza; Configurações não se cria).
 * A matriz renderiza célula apenas para as ações listadas.
 *
 * `routes` é o prefixo (ou prefixos) de rota que o recurso cobre; existe para
 * documentar o mapeamento recurso→endpoint, já que dois itens de menu cobrem
 * mais de um prefixo cada.
 */

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'custom_field',
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** Coluna do banco correspondente a cada ação. */
export const ACTION_COLUMN: Record<PermissionAction, string> = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
  export: 'can_export',
  custom_field: 'can_custom_field',
};

export interface MenuResource {
  /** Chave natural, estável — é o que vai gravado em UserGroupPermission.resource. */
  key: string;
  /** Rótulo exibido na matriz. */
  label: string;
  /** Seção do menu, usada para agrupar as linhas. */
  group: string;
  /** Ações aplicáveis a este recurso. */
  actions: PermissionAction[];
  /** Prefixos de rota cobertos pelo recurso. */
  routes: string[];
}

/** Conjunto completo, para recursos de cadastro com CRUD. */
const FULL: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'export', 'custom_field'];

export const MENU_RESOURCES: MenuResource[] = [
  // ─── Principal ─────────────────────────────────────────────────────────────
  {
    key: 'dashboard',
    label: 'Resumo',
    group: 'Principal',
    actions: ['view'],
    routes: ['/dashboard'],
  },

  // ─── Cadastrar ─────────────────────────────────────────────────────────────
  {
    key: 'users',
    label: 'Administrador',
    group: 'Cadastrar',
    actions: FULL,
    routes: ['/users'],
  },
  {
    key: 'user-groups',
    label: 'Grupo de Usuário',
    group: 'Cadastrar',
    actions: FULL,
    routes: ['/user-groups'],
  },
  {
    key: 'companies',
    label: 'Empresa',
    group: 'Cadastrar',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    routes: ['/companies'],
  },
  {
    key: 'properties',
    label: 'Imóvel',
    group: 'Cadastrar',
    actions: FULL,
    routes: ['/properties', '/iptu-property'],
  },
  {
    key: 'agencies',
    label: 'Imobiliária',
    group: 'Cadastrar',
    actions: FULL,
    routes: ['/agencies'],
  },
  {
    key: 'tenants',
    label: 'Inquilinos',
    group: 'Cadastrar',
    actions: FULL,
    routes: ['/tenants'],
  },
  {
    key: 'owners',
    label: 'Proprietários',
    group: 'Cadastrar',
    actions: FULL,
    routes: ['/owners'],
  },
  {
    key: 'property-types',
    label: 'Tipo Imóvel',
    group: 'Cadastrar',
    actions: FULL,
    routes: ['/property-types'],
  },

  // ─── Locações ──────────────────────────────────────────────────────────────
  {
    key: 'leases',
    label: 'Locações',
    group: 'Locações',
    actions: FULL,
    routes: ['/leases'],
  },

  // ─── Financeiro ────────────────────────────────────────────────────────────
  {
    key: 'financial-institutions',
    label: 'Instituições Financeiras',
    group: 'Financeiro',
    actions: FULL,
    routes: ['/financial-institution'],
  },
  {
    key: 'financial-categories',
    label: 'Categorias/Subcategorias',
    group: 'Financeiro',
    actions: FULL,
    routes: ['/financial-category', '/financial-subcategory'],
  },
  {
    key: 'financial-cards',
    label: 'Cartões de Crédito',
    group: 'Financeiro',
    actions: FULL,
    routes: ['/financial-card'],
  },
  {
    key: 'financial-centers',
    label: 'Centros',
    group: 'Financeiro',
    actions: FULL,
    routes: ['/financial-center'],
  },
  {
    key: 'financial-suppliers',
    label: 'Contatos',
    group: 'Financeiro',
    actions: FULL,
    routes: ['/financial-supplier'],
  },
  {
    key: 'financial-transactions',
    label: 'Lançamentos',
    group: 'Financeiro',
    actions: FULL,
    routes: ['/financial-transaction', '/financial-invoice'],
  },
  {
    key: 'planning',
    label: 'Planejamento e Controle',
    group: 'Financeiro',
    actions: FULL,
    routes: ['/planning'],
  },

  // ─── Configurações ─────────────────────────────────────────────────────────
  {
    key: 'settings',
    label: 'Configurações',
    group: 'Configurações',
    actions: ['view', 'edit', 'export'],
    routes: ['/backup', '/company/branding'],
  },
  {
    key: 'audit-logs',
    label: 'Auditoria',
    group: 'Configurações',
    // Log é gerado pelo sistema, não cadastrado — só visualização faz sentido.
    actions: ['view'],
    routes: ['/audit-logs'],
  },
];

const BY_KEY = new Map(MENU_RESOURCES.map((r) => [r.key, r]));

export function getMenuResource(key: string): MenuResource | undefined {
  return BY_KEY.get(key);
}

export function isValidResource(key: string): boolean {
  return BY_KEY.has(key);
}

/** True se a ação faz sentido no recurso (usado para validar o payload da matriz). */
export function isActionApplicable(resourceKey: string, action: PermissionAction): boolean {
  return BY_KEY.get(resourceKey)?.actions.includes(action) ?? false;
}
