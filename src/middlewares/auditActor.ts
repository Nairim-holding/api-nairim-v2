import { Request, Response, NextFunction } from 'express';
import { auditActorStorage } from '../lib/auditContext';

/**
 * Captura quem está fazendo a requisição (usuário + IP) para que a extensão
 * do Prisma anexe essa informação aos AuditLog gerados automaticamente em
 * CRUD. Deve rodar depois de authenticateJWT (precisa de req.user).
 */
export const captureAuditActor = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user?.id) return next();

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  auditActorStorage.run(
    { userId: user.id, userName: user.name, userEmail: user.email, ip },
    next
  );
};
