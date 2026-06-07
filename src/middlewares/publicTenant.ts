import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { ApiResponse } from '../utils/api-response';
import { tenantStorage } from '../lib/tenantContext';

/**
 * Resolve a empresa pelo slug presente na URL (ex: /public/:companySlug/...)
 * e executa o restante da cadeia dentro do contexto de tenant — assim o
 * Prisma estendido (lib/prisma.ts) injeta company_id automaticamente nas
 * queries dos services existentes, sem precisar de JWT.
 */
export const resolveCompanyBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = String(req.params?.companySlug || '');
    if (!slug) return res.status(400).json(ApiResponse.error('Empresa não identificada'));

    const company = await prisma.company.findFirst({
      where: { slug, is_active: true, deleted_at: null },
      select: { id: true, name: true, slug: true },
    });

    if (!company) return res.status(404).json(ApiResponse.error('Empresa não encontrada'));

    (req as any).company = company;
    tenantStorage.run(company.id, () => next());
  } catch {
    res.status(500).json(ApiResponse.error('Erro ao identificar empresa'));
  }
};
