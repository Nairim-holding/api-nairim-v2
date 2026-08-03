import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/api-response';
import { UserGroupPermissionService } from '../services/UserGroupPermissionService';
import { isValidResource, type PermissionAction } from '../lib/menuResources';

/**
 * Guard de diretivas de acesso.
 *
 * Ordem de decisão (a primeira que casar decide):
 *  1. SUPER_ADMIN  → passa (acesso cross-empresa, único papel realmente irrestrito)
 *  2. sem grupo    → passa (preserva o comportamento anterior às diretivas;
 *                    a restrição só vale depois de atribuir um grupo)
 *  3. permissão do grupo para (recurso, ação) → passa, senão 403
 *
 * IMPORTANTE: papel ADMIN (ou o legado "administrador") NÃO tem bypass aqui.
 * `AuthService.login` grava no JWT `role: 'administrador'` para todo usuário
 * Role.ADMIN (ver roleMap em AuthService) — e é ESSE o papel de todo usuário
 * criado pela tela de Cadastro de Administradores. Um bypass baseado nesse
 * papel tornaria as Diretivas de Acesso sempre inertes: praticamente nenhum
 * usuário do sistema teria suas permissões de grupo aplicadas. Um ADMIN sem
 * grupo continua irrestrito (regra 2); só fica restrito quando alguém o
 * atribui deliberadamente a um grupo com a matriz configurada.
 *
 * Sempre aplicar DEPOIS de authenticateJWT + requireTenant.
 */
export function requirePermission(resource: string, action: PermissionAction) {
  if (!isValidResource(resource)) {
    // Erro de programação: falha no boot, não em runtime silencioso.
    throw new Error(`requirePermission: recurso desconhecido "${resource}"`);
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user?.id) {
      return res.status(401).json(ApiResponse.error('Usuário não autenticado'));
    }

    const role = String(user.role || '');
    if (role === 'SUPER_ADMIN') {
      return next();
    }

    try {
      const perms = await UserGroupPermissionService.resolveForUser(String(user.id));

      // null = usuário sem grupo → sem restrição
      if (perms === null) {
        return next();
      }

      if (perms.get(resource)?.has(action)) {
        return next();
      }

      return res.status(403).json(
        ApiResponse.error('Acesso negado. Seu grupo de usuário não tem permissão para esta ação.')
      );
    } catch (error: any) {
      console.error(`❌ Erro ao verificar permissão ${resource}:${action}`, error);
      return res.status(500).json(ApiResponse.error('Erro ao verificar permissões'));
    }
  };
}

/** Atalhos, para deixar as rotas legíveis. */
export const canView = (resource: string) => requirePermission(resource, 'view');
export const canCreate = (resource: string) => requirePermission(resource, 'create');
export const canEdit = (resource: string) => requirePermission(resource, 'edit');
export const canDelete = (resource: string) => requirePermission(resource, 'delete');
export const canExport = (resource: string) => requirePermission(resource, 'export');
