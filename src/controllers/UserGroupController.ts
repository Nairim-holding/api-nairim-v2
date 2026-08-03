// controllers/UserGroupController.ts
import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { UserGroupValidator } from '../lib/validators/user-group';
import { UserGroupPermissionValidator } from '../lib/validators/user-group-permission';
import { UserGroupService } from '@/services/UserGroupService';
import { UserGroupPermissionService } from '@/services/UserGroupPermissionService';

/** Id do usuário autenticado, usado para preencher a autoria do registro. */
function currentUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id ? String(user.id) : null;
}

export class UserGroupController {
  static async getUserGroups(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 30);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      // Processar sort no formato sort[field]=direction
      const sortOptions: any = {};
      const filters: Record<string, any> = {};

      console.log('📥 Query params recebidos para grupos de usuário:', req.query);

      // Processar parâmetros de ordenação no formato sort[field]
      Object.entries(req.query || {}).forEach(([key, value]) => {
        console.log(`🔧 Processando parâmetro: ${key} =`, value);

        // Verificar se é parâmetro de ordenação no formato sort[field]
        if (key.startsWith('sort[') && key.endsWith(']')) {
          const field = key.substring(5, key.length - 1); // Extrai o nome do campo
          const direction = String(value).toLowerCase();

          if (direction === 'asc' || direction === 'desc') {
            sortOptions[`sort_${field}`] = direction;
            console.log(`📌 Ordenação detectada: ${field} -> ${direction}`);
          }
        }
        // Verificar se é parâmetro de ordenação no formato antigo sort_field
        else if (key.startsWith('sort_')) {
          const field = key.substring(5); // Remove "sort_"
          const direction = String(value).toLowerCase();

          if (direction === 'asc' || direction === 'desc') {
            sortOptions[`sort_${field}`] = direction;
            console.log(`📌 Ordenação detectada (formato antigo): ${field} -> ${direction}`);
          }
        }
        // Processar filtros (ignorando parâmetros padrão)
        else if (
          !['limit', 'page', 'search', 'includeInactive'].includes(key) &&
          !key.startsWith('sort')
        ) {
          if (key.startsWith('filter[')) {
            const filterField = key.substring(7, key.length - 1);
            if (value && value !== '' && value !== 'undefined' && value !== 'null') {
              filters[filterField] = value;
            }
          }
          // Tratar filtros diretos também
          else if (value && value !== '' && value !== 'undefined' && value !== 'null') {
            try {
              if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                const parsedValue = JSON.parse(value);
                if (parsedValue && typeof parsedValue === 'object') {
                  filters[key] = parsedValue;
                } else {
                  filters[key] = value;
                }
              } else {
                filters[key] = value;
              }
            } catch {
              filters[key] = value;
            }
          }
        }
      });

      console.log('🔍 Opções de ordenação extraídas:', sortOptions);
      console.log('📋 Filtros extraídos:', filters);

      const validation = UserGroupValidator.validateQueryParams({ ...req.query, ...sortOptions });
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const result = await UserGroupService.getUserGroups({
        limit,
        page,
        search,
        filters,
        sortOptions,
        includeInactive,
      });

      // Desabilitar cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Erro ao buscar grupos de usuário:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getUserGroupById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const userGroup = await UserGroupService.getUserGroupById(id);

      res.status(200).json(
        ApiResponse.success(userGroup, 'Grupo de usuário recuperado com sucesso')
      );
    } catch (error: any) {
      if (error.message === 'User group not found') {
        return res.status(404).json(ApiResponse.error('Grupo de usuário não encontrado'));
      }
      console.error('Erro ao buscar grupo de usuário:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async createUserGroup(req: Request, res: Response) {
    try {
      const validation = UserGroupValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const userGroup = await UserGroupService.createUserGroup({
        description: req.body.description,
        created_by: currentUserId(req),
      });

      res.status(201).json(
        ApiResponse.success(userGroup, `Grupo de usuário "${userGroup.description}" criado com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao criar grupo de usuário:', error);

      if (error.message === 'User group already exists') {
        return res.status(409).json(ApiResponse.error('Este grupo de usuário já existe'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao criar grupo de usuário: ${error.message}`));
    }
  }

  static async updateUserGroup(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const validation = UserGroupValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const userGroup = await UserGroupService.updateUserGroup(id, {
        description: req.body.description,
        updated_by: currentUserId(req),
      });

      res.status(200).json(
        ApiResponse.success(userGroup, `Grupo de usuário "${userGroup.description}" atualizado com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao atualizar grupo de usuário:', error);

      if (error.message === 'User group not found') {
        return res.status(404).json(ApiResponse.error('Grupo de usuário não encontrado'));
      }

      if (error.message === 'User group already exists') {
        return res.status(409).json(ApiResponse.error('Este grupo de usuário já existe'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao atualizar grupo de usuário: ${error.message}`));
    }
  }

  static async deleteUserGroup(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const userGroup = await UserGroupService.deleteUserGroup(id, currentUserId(req));

      res.status(200).json(
        ApiResponse.success(null, `Grupo de usuário "${userGroup.description}" excluído com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao excluir grupo de usuário:', error);

      if (error.message === 'User group not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Grupo de usuário não encontrado ou já excluído'));
      }

      res.status(500).json(ApiResponse.error('Erro ao excluir grupo de usuário'));
    }
  }

  static async restoreUserGroup(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const userGroup = await UserGroupService.restoreUserGroup(id, currentUserId(req));

      res.status(200).json(
        ApiResponse.success(null, `Grupo de usuário "${userGroup.description}" restaurado com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao restaurar grupo de usuário:', error);

      if (error.message === 'User group not found') {
        return res.status(404).json(ApiResponse.error('Grupo de usuário não encontrado'));
      }

      if (error.message === 'User group is not deleted') {
        return res.status(400).json(ApiResponse.error('O grupo de usuário não está excluído'));
      }

      res.status(500).json(ApiResponse.error('Erro ao restaurar grupo de usuário'));
    }
  }

  static async getUserGroupFilters(req: Request, res: Response) {
    try {
      // Extrair filtros dos query params para contexto
      const filters: Record<string, any> = {};

      console.log('📥 Query params recebidos para filtros de grupos de usuário:', req.query);

      // Processar parâmetros de filtro
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          console.log(`🔧 Processando parâmetro de filtro: ${key} =`, value);

          try {
            const parsedValue = JSON.parse(value as string);
            if (parsedValue && typeof parsedValue === 'object') {
              filters[key] = parsedValue;
            } else {
              filters[key] = value;
            }
          } catch {
            filters[key] = value;
          }
        }
      });

      console.log('📋 Filtros processados para o contexto:', filters);

      const filtersData = await UserGroupService.getUserGroupFilters(filters);

      res.status(200).json(
        ApiResponse.success(filtersData, 'Filtros recuperados com sucesso')
      );
    } catch (error) {
      console.error('❌ Erro ao buscar filtros de grupos de usuário:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  /**
   * Clona um grupo, copiando todas as diretivas para um grupo novo.
   * Exige permissão de CRIAÇÃO — o resultado é um grupo novo.
   */
  static async cloneUserGroup(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      // Mesma regra de descrição do cadastro comum
      const validation = UserGroupValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const { group, clonedPermissions } = await UserGroupService.cloneUserGroup(id, {
        description: req.body.description,
        created_by: currentUserId(req),
      });

      res.status(201).json(
        ApiResponse.success(
          group,
          `Grupo "${group.description}" criado com ${clonedPermissions} diretiva(s) clonada(s)`
        )
      );
    } catch (error: any) {
      console.error('❌ Erro ao clonar grupo de usuário:', error);

      if (error.message === 'User group not found') {
        return res.status(404).json(ApiResponse.error('Grupo de usuário de origem não encontrado'));
      }

      if (error.message === 'User group already exists') {
        return res.status(409).json(ApiResponse.error('Já existe um grupo de usuário com essa descrição'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao clonar grupo de usuário: ${error.message}`));
    }
  }

  // ─── Diretivas de acesso ───────────────────────────────────────────────────

  /** Catálogo de recursos (itens de menu) para montar as linhas da matriz. */
  static async getResourceCatalog(_req: Request, res: Response) {
    try {
      const catalog = UserGroupPermissionService.getResourceCatalog();
      res.status(200).json(
        ApiResponse.success(catalog, 'Recursos recuperados com sucesso')
      );
    } catch (error) {
      console.error('❌ Erro ao buscar catálogo de recursos:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getPermissions(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      // Garante que o grupo existe e é da empresa do usuário antes de expor diretivas
      await UserGroupService.getUserGroupById(id);

      const permissions = await UserGroupPermissionService.getPermissions(id);

      res.status(200).json(
        ApiResponse.success(permissions, 'Diretivas de acesso recuperadas com sucesso')
      );
    } catch (error: any) {
      if (error.message === 'User group not found') {
        return res.status(404).json(ApiResponse.error('Grupo de usuário não encontrado'));
      }
      console.error('❌ Erro ao buscar diretivas de acesso:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async updatePermissions(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const validation = UserGroupPermissionValidator.validateUpsert(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const permissions = await UserGroupPermissionService.upsertPermissions(
        id,
        req.body.permissions
      );

      // Registra quem alterou o grupo, já que mexer nas diretivas é alterá-lo
      await UserGroupService.touchUserGroup(id, currentUserId(req));

      res.status(200).json(
        ApiResponse.success(permissions, 'Diretivas de acesso salvas com sucesso')
      );
    } catch (error: any) {
      if (error.message === 'User group not found') {
        return res.status(404).json(ApiResponse.error('Grupo de usuário não encontrado'));
      }
      console.error('❌ Erro ao salvar diretivas de acesso:', error);
      res.status(500).json(ApiResponse.error('Erro ao salvar diretivas de acesso'));
    }
  }
}
