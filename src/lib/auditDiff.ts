import { SENSITIVE_FIELDS, GLOBAL_DIFF_EXCLUDED_FIELDS } from './auditModels';

/**
 * Normaliza um valor de campo para algo seguro de gravar em Json e comparável
 * com `!==`. Date vira ISO string; Decimal (Prisma) vira string via toString();
 * relação (objeto/array aninhado) vira `undefined` — não faz parte do diff
 * escalar do registro.
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // Prisma.Decimal e afins expõem toString(); relações (objeto puro, array)
    // não — ficam de fora do snapshot escalar.
    if (typeof (value as any).toString === 'function' && (value as any).toString !== Object.prototype.toString) {
      return (value as any).toString();
    }
    return undefined;
  }
  return value;
}

/** Todos os campos escalares de um registro, sanitizados — usado no CREATE. */
export function sanitizeRecord(model: string, record: Record<string, any> | null | undefined): Record<string, unknown> | null {
  if (!record) return null;

  const sensitive = new Set(SENSITIVE_FIELDS[model] ?? []);
  const out: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(record)) {
    if (sensitive.has(key) || GLOBAL_DIFF_EXCLUDED_FIELDS.has(key)) continue;
    const value = sanitizeValue(rawValue);
    if (value !== undefined) out[key] = value;
  }

  return out;
}

/**
 * Diff campo a campo entre o estado antes e depois de um update, restrito às
 * chaves que a própria escrita tocou (`touchedKeys`, tipicamente as chaves de
 * `args.data`). Só entram no resultado os campos cujo valor realmente mudou —
 * é isso que a tela de detalhe mostra (uma linha por campo alterado, não o
 * registro inteiro).
 */
export function diffRecords(
  model: string,
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
  touchedKeys: string[]
): { oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null } {
  const sensitive = new Set(SENSITIVE_FIELDS[model] ?? []);
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const key of touchedKeys) {
    if (sensitive.has(key) || GLOBAL_DIFF_EXCLUDED_FIELDS.has(key)) continue;

    const oldRaw = sanitizeValue(before?.[key]);
    const newRaw = sanitizeValue(after?.[key]);
    if (oldRaw === undefined && newRaw === undefined) continue;
    if (oldRaw === newRaw) continue;

    oldValues[key] = oldRaw ?? null;
    newValues[key] = newRaw ?? null;
  }

  const hasChanges = Object.keys(newValues).length > 0;
  return {
    oldValues: hasChanges ? oldValues : null,
    newValues: hasChanges ? newValues : null,
  };
}

/**
 * Chaves escalares "tocadas" por um `data` de update/create — filtra fora
 * operadores/relações (objetos aninhados como `{ connect: {...} }`), que não
 * são substituição direta de valor.
 */
export function scalarKeysOf(data: Record<string, any> | null | undefined): string[] {
  if (!data) return [];
  return Object.keys(data).filter((key) => {
    const value = data[key];
    return value === null || typeof value !== 'object' || value instanceof Date;
  });
}
