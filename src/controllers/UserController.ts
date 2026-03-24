import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { UserValidator } from '../lib/validators/user';
import { AuthService } from '@/services/AuthService';

export class UserController {
  static async getUsers(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      // Processar sort no formato sort[name]=desc
      const sortOptions: any = {};
      
      console.log('📥 Query params recebidos:', req.query);
      
      // Processar parâmetros de ordenação no formato sort[field]=direction
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
      });

      console.log('🔍 Opções de ordenação extraídas:', sortOptions);

      // Extrair filtros
      const filters: Record<string, any> = {};
      
      Object.entries(req.query || {}).forEach(([key, value]) => {
        // Ignorar parâmetros que não são filtros
        if (
          key === 'limit' || 
          key === 'page' || 
          key === 'search' || 
          key === 'includeInactive' ||
          key.startsWith('sort')
        ) {
          return;
        }
        
        // Processar filtros
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          console.log(`📌 Processando filtro: ${key} =`, value);
          
          try {
            // Tentar parsear como JSON (para objetos como date ranges)
            if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
              const parsedValue = JSON.parse(value);
              if (parsedValue && typeof parsedValue === 'object') {
                filters[key] = parsedValue;
              } else {
                filters[key] = value;
              }
            } else {
              // Se não for JSON, tratar como string
              filters[key] = value;
            }
          } catch {
            // Se falhar no parse, usar o valor original
            filters[key] = value;
          }
        }
      });

      console.log('📋 Filtros extraídos:', filters);

      const validation = UserValidator.validateQueryParams({ ...req.query, ...sortOptions });
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      const result = await UserService.getUsers({
        limit,
        page,
        search,
        sortOptions,
        includeInactive,
        filters
      });

      // Desabilitar cache para filtros dinâmicos
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.status(200).json({
        data: result.data, 
        count: result.count,
        totalPages: result.totalPages,
        currentPage: result.currentPage
      });
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getUserById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }
      
      const user = await UserService.getUserById(id);

      res.status(200).json(
        ApiResponse.success(user, 'Usuário recuperado com sucesso')
      );
    } catch (error: any) {
      if (error.message === 'User not found' || error.message === 'Usuário não encontrado') {
        return res.status(404).json(ApiResponse.error('Usuário não encontrado'));
      }
      console.error('Erro ao buscar usuário:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async getUserFilters(req: Request, res: Response) {
    try {
      const filters: Record<string, any> = {};
      
      console.log('📥 Parâmetros de consulta recebidos:', req.query);

      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          console.log(`🔧 Processando parâmetro: ${key} =`, value);
          
          try {
            const parsedValue = JSON.parse(value as string);
            if (parsedValue && typeof parsedValue === 'object') {
              filters[key] = parsedValue;
            } else {
              filters[key] = value;
            }
          } catch {
            // Se não for JSON, tratar como string
            filters[key] = value;
          }
        }
      });

      console.log('📋 Filtros processados para o contexto:', filters);

      const filtersData = await UserService.getUserFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filtros recuperados com sucesso')
      );
    } catch (error) {
      console.error('❌ Erro ao buscar filtros:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }

  static async createUser(req: Request, res: Response) {
    try {
      const validation = UserValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const user = await UserService.createUser(req.body);

      res.status(201).json(
        ApiResponse.success(user, `Usuário ${user.name} criado com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);

      if (error.message === 'Email already registered' || error.message === 'E-mail já cadastrado') {
        return res.status(409).json(ApiResponse.error('E-mail já cadastrado'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao criar usuário: ${error.message}`));
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const validation = UserValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      const user = await UserService.updateUser(id, req.body);

      res.status(200).json(
        ApiResponse.success(user, `Usuário ${user.name} atualizado com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);

      if (error.message === 'User not found' || error.message === 'Usuário não encontrado') {
        return res.status(404).json(ApiResponse.error('Usuário não encontrado'));
      }

      if (error.message === 'Email already registered for another user' || error.message === 'E-mail já cadastrado para outro usuário') {
        return res.status(409).json(ApiResponse.error('E-mail já cadastrado para outro usuário'));
      }

      res.status(400).json(ApiResponse.error(`Erro ao atualizar usuário: ${error.message}`));
    }
  }

  static async deleteUser(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const user = await UserService.deleteUser(id);

      res.status(200).json(
        ApiResponse.success(null, `Usuário ${user.name} marcado como excluído com sucesso (soft delete)`)
      );
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);

      if (error.message === 'User not found or already deleted' || error.message === 'Usuário não encontrado ou já excluído') {
        return res.status(404).json(ApiResponse.error('Usuário não encontrado ou já excluído'));
      }

      res.status(500).json(ApiResponse.error('Erro ao excluir usuário'));
    }
  }

  static async restoreUser(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('O ID é obrigatório'));
      }

      const user = await UserService.restoreUser(id);

      res.status(200).json(
        ApiResponse.success(null, `Usuário ${user.name} restaurado com sucesso`)
      );
    } catch (error: any) {
      console.error('Erro ao restaurar usuário:', error);

      if (error.message === 'User not found' || error.message === 'Usuário não encontrado') {
        return res.status(404).json(ApiResponse.error('Usuário não encontrado'));
      }

      if (error.message === 'User is not deleted' || error.message === 'O usuário não está excluído') {
        return res.status(400).json(ApiResponse.error('O usuário não está excluído'));
      }

      res.status(500).json(ApiResponse.error('Erro ao restaurar usuário'));
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      const { oldPassword, newPassword } = req.body;

      if (!id) {
        return res.status(400).json(ApiResponse.error('ID é obrigatório'));
      }

      if (!oldPassword || !newPassword) {
        return res.status(400).json(ApiResponse.error('Senha atual e nova senha são obrigatórias'));
      }

      if (newPassword.length < 6) {
        return res.status(400).json(ApiResponse.error('Nova senha deve ter no mínimo 6 caracteres'));
      }

      await AuthService.changePassword(id, oldPassword, newPassword);

      res.status(200).json(
        ApiResponse.success(null, 'Senha alterada com sucesso')
      );
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);

      if (error.message === 'Usuário não encontrado' || error.message === 'User not found') {
        return res.status(404).json(ApiResponse.error('Usuário não encontrado'));
      }

      if (error.message === 'Senha atual incorreta' || error.message === 'Incorrect current password') {
        return res.status(400).json(ApiResponse.error('Senha atual incorreta'));
      }

      res.status(500).json(ApiResponse.error('Erro ao alterar senha'));
    }
  }
}