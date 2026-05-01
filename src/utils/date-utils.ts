/**
 * Utilitários para tratamento de datas sem problemas de timezone
 * Para campos DATE-only (sem hora) do banco de dados
 */

/**
 * Converte string de data para objeto Date mantendo a data local (sem conversão UTC)
 * Uso: Para campos @db.Date do Prisma que devem manter a data exata informada
 */
export function parseLocalDate(dateString: string | Date): Date {
  if (dateString instanceof Date) {
    // Se já é Date, criar nova instância sem modificar
    return new Date(dateString.getFullYear(), dateString.getMonth(), dateString.getDate());
  }
  
  if (!dateString) return new Date();
  
  // Parse da string mantendo timezone local
  const date = new Date(dateString);
  
  // Ajuste para timezone do Brasil (UTC-3) quando necessário
  // Se a data foi convertida para UTC, ajustamos de volta
  const timezoneOffset = date.getTimezoneOffset();
  if (timezoneOffset !== 0) {
    // Adiciona o offset em minutos para corrigir a data
    date.setMinutes(date.getMinutes() + timezoneOffset);
  }
  
  // Retorna apenas a parte da data (sem hora)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Formata data para string no formato YYYY-MM-DD (ISO sem timezone)
 * Uso: Para enviar ao frontend ou armazenar sem problemas de timezone
 */
export function formatLocalDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata data para exibição no formato brasileiro DD/MM/YYYY
 * Uso: Para display na grid sem problemas de timezone
 */
export function displayDate(date: Date | string | null): string {
  if (!date) return '';
  
  const d = date instanceof Date ? date : parseLocalDate(date);
  return d.toLocaleDateString('pt-BR');
}

/**
 * Verifica se duas datas são o mesmo dia (ignorando hora/timezone)
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = date1 instanceof Date ? date1 : parseLocalDate(date1);
  const d2 = date2 instanceof Date ? date2 : parseLocalDate(date2);
  
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * Cria objeto Date com data específica sem problemas de timezone
 */
export function createDateLocal(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day); // month é 0-indexed
}
