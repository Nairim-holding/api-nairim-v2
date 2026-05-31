import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/api-response';
import { tenantStorage } from '../lib/tenantContext';

export const requireTenant = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user?.company_id) {
    return res.status(403).json(
      ApiResponse.error('Contexto de empresa não identificado. Faça login novamente.')
    );
  }
  // Executa toda a cadeia de middlewares/handler dentro do contexto da empresa.
  // getCurrentCompanyId() retorna este valor em qualquer ponto assíncrono da request.
  tenantStorage.run(user.company_id, () => next());
};
