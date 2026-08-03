/**
 * Modelos auditados automaticamente pela extensão do Prisma (src/lib/prisma.ts)
 * em create/update/delete singulares.
 *
 * É o mesmo conjunto de TENANT_MODELS, menos:
 *  - UserColumnPreference, UserDashboardLayout, Favorite: preferência de UI,
 *    não auditoria de negócio.
 *  - UserGroupPermission, UserAccessSchedule: só gravam via deleteMany+createMany
 *    (Tarefas 2 e 5) — como só auditamos operações singulares, essas nunca
 *    disparariam o hook mesmo sem a exclusão explícita. Excluídas aqui por
 *    clareza: sem isso, cada "salvar diretivas"/"salvar jornada" geraria
 *    dezenas de linhas de log.
 */
export const AUDITED_MODELS = new Set([
  'Agency', 'Property', 'PropertyType', 'User', 'Document', 'Owner', 'Tenant',
  'Lease', 'FinancialInstitution', 'Category', 'Subcategory', 'Card', 'Center',
  'Supplier', 'Transaction', 'Invoice', 'RecurringConfig', 'Planning', 'UserGroup',
]);

/**
 * Rótulo exibido na tela de Auditoria. `table_name` grava o nome bruto do
 * model (chave aqui) — a tradução é só de exibição/filtro, para que filtrar
 * por tabela continue exato mesmo se o rótulo mudar.
 */
export const MODEL_LABELS: Record<string, string> = {
  Agency: 'Imobiliária',
  Property: 'Imóvel',
  PropertyType: 'Tipo de Imóvel',
  User: 'Usuário',
  Document: 'Documento',
  Owner: 'Proprietário',
  Tenant: 'Inquilino',
  Lease: 'Locação',
  FinancialInstitution: 'Instituição Financeira',
  Category: 'Categoria',
  Subcategory: 'Subcategoria',
  Card: 'Cartão',
  Center: 'Centro',
  Supplier: 'Fornecedor',
  Transaction: 'Lançamento',
  Invoice: 'Fatura',
  RecurringConfig: 'Recorrência',
  Planning: 'Planejamento',
  UserGroup: 'Grupo de Usuário',
  Auth: 'Login',
};

export function modelLabel(tableName: string): string {
  return MODEL_LABELS[tableName] ?? tableName;
}

/**
 * Campos que nunca entram no snapshot antes/depois — segredos que não podem
 * vazar para a tela de auditoria, mesmo que o model esteja em AUDITED_MODELS.
 */
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  User: ['password'],
};

/**
 * Campos ignorados no diff de TODOS os modelos: `updated_at` muda em toda
 * escrita (é `@updatedAt`) e apareceria como "alterado" mesmo quando o único
 * campo que o usuário de fato mudou foi outro — puro ruído no diff.
 */
export const GLOBAL_DIFF_EXCLUDED_FIELDS = new Set(['updated_at']);

/**
 * "is_active" → "Is Active". Sem mapa manual por model (19 models × muitos
 * campos cada seria um investimento grande); rótulo aproximado, não tradução
 * lapidada. Ver plano da Tarefa 7 para a ressalva completa.
 */
export function prettifyFieldName(field: string): string {
  return field
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
