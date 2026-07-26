/**
 * Propagação de alterações para os lançamentos SEGUINTES de uma série
 * (Parcelado / Recorrente).
 *
 * O cliente informa em `propagate_fields` quais campos devem ser replicados;
 * este módulo concentra a whitelist, o acoplamento entre campos dependentes e
 * o tratamento da descrição (que carrega a numeração da parcela).
 */

/** Campos que podem ser propagados para as parcelas/ocorrências seguintes. */
export const PROPAGATABLE_FIELDS = [
  'amount',
  'description',
  'category_id',
  'subcategory_id',
  'financial_institution_id',
  'card_id',
  'center_id',
  'supplier_id',
] as const;

export type PropagatableField = (typeof PROPAGATABLE_FIELDS)[number];

/**
 * Campos que dependem da Categoria: uma subcategoria/centro pertence a uma
 * categoria específica, então propagar `category_id` sozinho deixaria as
 * seguintes com vínculos de outra categoria. O formulário já limpa os dois ao
 * trocar a categoria; aqui garantimos o mesmo no servidor.
 */
const CATEGORY_DEPENDENTS: PropagatableField[] = ['subcategory_id', 'center_id'];

/**
 * Filtra a lista recebida do cliente pela whitelist, remove duplicatas e
 * arrasta os dependentes da Categoria. Retorna [] quando não há nada válido.
 */
export function sanitizePropagateFields(input: unknown): PropagatableField[] {
  if (!Array.isArray(input)) return [];

  const allowed = new Set<string>(PROPAGATABLE_FIELDS);
  const fields = new Set<PropagatableField>();

  for (const raw of input) {
    const field = String(raw);
    if (allowed.has(field)) fields.add(field as PropagatableField);
  }

  if (fields.has('category_id')) {
    for (const dependent of CATEGORY_DEPENDENTS) fields.add(dependent);
  }

  return PROPAGATABLE_FIELDS.filter((field) => fields.has(field));
}

/**
 * Sufixo de numeração gravado na descrição no momento da criação da série:
 * `"Aluguel - Parcela 3/12"`, `"Receita 2/6"`, `"Gasto - Recorrente 1/12"`.
 * A base pode ser vazia (quando o usuário não informou descrição).
 */
const SERIES_SUFFIX_REGEX = /^(?:(.*?)\s+-\s+)?(Parcela|Receita|Recorrente)\s+(\d+)\s*\/\s*(\d+)\s*$/;

export interface SeriesDescriptionParts {
  /** Texto sem a numeração. */
  base: string;
  /** `Parcela` | `Receita` | `Recorrente`, ou null se não houver numeração. */
  label: string | null;
  position: number | null;
  total: number | null;
}

export function parseSeriesDescription(description: unknown): SeriesDescriptionParts {
  const value = String(description ?? '').trim();
  const match = value.match(SERIES_SUFFIX_REGEX);

  if (!match) return { base: value, label: null, position: null, total: null };

  return {
    base: (match[1] ?? '').trim(),
    label: match[2],
    position: Number(match[3]),
    total: Number(match[4]),
  };
}

/**
 * Monta a descrição de um lançamento alvo preservando a numeração DELE.
 *
 * Editar a parcela 3/12 para "Aluguel reajustado" propaga a base e cada
 * seguinte mantém o próprio `N/M`. Alvo sem numeração (recorrência
 * config-based) recebe apenas a base.
 */
export function buildPropagatedDescription(newDescription: unknown, targetDescription: unknown): string {
  const { base } = parseSeriesDescription(newDescription);
  const target = parseSeriesDescription(targetDescription);

  // Sem base (descrição era só a numeração) não há o que propagar além dela.
  const fallback = String(newDescription ?? '').trim();

  if (target.label === null) return base || fallback;

  const suffix = `${target.label} ${target.position}/${target.total}`;
  return base ? `${base} - ${suffix}` : suffix;
}
