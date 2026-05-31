import { AsyncLocalStorage } from 'async_hooks';

// Armazena o company_id da empresa autenticada por contexto de requisição.
// AsyncLocalStorage propaga o valor por toda a cadeia assíncrona da request
// sem precisar passar como parâmetro em cada função.
export const tenantStorage = new AsyncLocalStorage<string>();

export function getCurrentCompanyId(): string | undefined {
  return tenantStorage.getStore();
}
