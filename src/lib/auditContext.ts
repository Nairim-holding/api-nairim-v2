import { AsyncLocalStorage } from 'async_hooks';

/**
 * Quem está fazendo a requisição atual, para a extensão do Prisma anexar aos
 * registros de AuditLog gerados automaticamente em CRUD (ver prisma.ts).
 * Independente de tenantContext.ts — mesmo padrão (AsyncLocalStorage), contexto
 * diferente. Populado pelo middleware captureAuditActor.
 */
export interface AuditActor {
  userId: string;
  userName: string;
  userEmail: string;
  ip: string;
}

export const auditActorStorage = new AsyncLocalStorage<AuditActor>();

export function getCurrentAuditActor(): AuditActor | undefined {
  return auditActorStorage.getStore();
}
