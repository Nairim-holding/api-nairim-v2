/**
 * Utilitários para tratamento de datas sem problemas de timezone
 * Para campos DATE-only (sem hora) do banco de dados
 */

/**
 * Converte string de data para objeto Date mantendo a data na meia-noite UTC.
 * Como o Prisma utiliza o componente UTC para salvar datas no formato @db.Date, 
 * isso assegura que o dia gravado seja exato, não importando o fuso horário do servidor.
 */
export function parseLocalDate(dateString: string | Date): Date {
  if (dateString instanceof Date) {
    // Se Prisma devolveu ou já é Date, usamos o componente UTC atual para recriar em meia-noite UTC
    return new Date(Date.UTC(dateString.getUTCFullYear(), dateString.getUTCMonth(), dateString.getUTCDate()));
  }
  
  if (!dateString) return new Date();
  
  // Se a string for formato ISO (YYYY-MM-DD)
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const parts = dateString.split('T')[0].split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Fallback para outros formatos
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return new Date();
  
  // Extrai componentes do Date interpretado (no fuso local) e joga para UTC
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Formata data para string no formato YYYY-MM-DD (ISO sem timezone)
 * Lê em UTC para que o componente seja sempre o esperado.
 */
export function formatLocalDate(date: Date | string): string {
  const d = date instanceof Date ? date : parseLocalDate(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata data para exibição no formato brasileiro DD/MM/YYYY
 */
export function displayDate(date: Date | string | null): string {
  if (!date) return '';
  const d = date instanceof Date ? date : parseLocalDate(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

/**
 * Verifica se duas datas são o mesmo dia (ignorando hora/timezone)
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = date1 instanceof Date ? date1 : parseLocalDate(date1);
  const d2 = date2 instanceof Date ? date2 : parseLocalDate(date2);
  
  return d1.getUTCFullYear() === d2.getUTCFullYear() &&
         d1.getUTCMonth() === d2.getUTCMonth() &&
         d1.getUTCDate() === d2.getUTCDate();
}

/**
 * Cria objeto Date com data específica sem problemas de timezone (salvo em UTC)
 */
export function createDateLocal(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day)); // month é 0-indexed
}
