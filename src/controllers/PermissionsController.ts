import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { UserGroupPermissionService } from '../services/UserGroupPermissionService';
import { MENU_RESOURCES } from '../lib/menuResources';

/**
 * Auto-serviço: "quais são as MINHAS permissões efetivas". Usado pelo front
 * para filtrar menu/ícones de ação — não para autorizar (isso continua sendo
 * o `requirePermission` em cada rota). Por isso não tem `canView` na frente:
 * todo usuário autenticado pode ler as próprias permissões, mesmo quem não
 * pode ver "Grupo de Usuário" (o catálogo aqui é metadado do próprio usuário,
 * não da tela de gestão de grupos).
 */
export class PermissionsController {
  static async getMyPermissions(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json(ApiResponse.error('Usuário não autenticado'));
      }

      // Mesmo critério do guard requirePermission: só SUPER_ADMIN é
      // irrestrito por papel. ADMIN sem grupo também é irrestrito, mas isso
      // vem do resolveForUser (perms === null), não de um bypass de role aqui.
      if (String(user.role || '') === 'SUPER_ADMIN') {
        return res.status(200).json(
          ApiResponse.success({ unrestricted: true, resources: {} }, 'Permissões resolvidas')
        );
      }

      const perms = await UserGroupPermissionService.resolveForUser(String(user.id));

      if (perms === null) {
        return res.status(200).json(
          ApiResponse.success({ unrestricted: true, resources: {} }, 'Permissões resolvidas')
        );
      }

      const resources: Record<string, Record<string, boolean>> = {};
      for (const resource of MENU_RESOURCES) {
        const granted = perms.get(resource.key);
        const row: Record<string, boolean> = {};
        for (const action of resource.actions) {
          row[action] = granted?.has(action) ?? false;
        }
        resources[resource.key] = row;
      }

      return res.status(200).json(
        ApiResponse.success({ unrestricted: false, resources }, 'Permissões resolvidas')
      );
    } catch (error: any) {
      console.error('❌ Erro ao resolver permissões do usuário atual:', error);
      return res.status(500).json(ApiResponse.error('Erro ao resolver permissões'));
    }
  }
}
