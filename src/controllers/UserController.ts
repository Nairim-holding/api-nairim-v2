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

      // **CORREÇÃO: Processar sort no formato sort[name]=desc**
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

      console.log('🔍 Sort options extraídos:', sortOptions);

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
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
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
      console.error('Error getting users:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getUserById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const user = await UserService.getUserById(id);

      res.status(200).json(
        ApiResponse.success(user, 'User retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'User not found') {
        return res.status(404).json(ApiResponse.error('User not found'));
      }
      console.error('Error getting user:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getUserFilters(req: Request, res: Response) {
    try {
      // Extrair filtros dos query params para contexto
      const filters: Record<string, any> = {};
      
      console.log('📥 Received query params:', req.query);

      // Processar todos os parâmetros de filtro
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          console.log(`🔧 Processing param: ${key} =`, value);
          
          try {
            // Tentar parsear como JSON (para objetos como date ranges)
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

      console.log('📋 Parsed filters for context:', filters);

      const filtersData = await UserService.getUserFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('❌ Error getting filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createUser(req: Request, res: Response) {
    try {
      const validation = UserValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const user = await UserService.createUser(req.body);

      res.status(201).json(
        ApiResponse.success(user, `User ${user.name} created successfully`)
      );
    } catch (error: any) {
      console.error('Error creating user:', error);

      if (error.message === 'Email already registered') {
        return res.status(409).json(ApiResponse.error('Email already registered'));
      }

      res.status(400).json(ApiResponse.error(`Error creating user: ${error.message}`));
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const validation = UserValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const user = await UserService.updateUser(id, req.body);

      res.status(200).json(
        ApiResponse.success(user, `User ${user.name} updated successfully`)
      );
    } catch (error: any) {
      console.error('Error updating user:', error);

      if (error.message === 'User not found') {
        return res.status(404).json(ApiResponse.error('User not found'));
      }

      if (error.message === 'Email already registered for another user') {
        return res.status(409).json(ApiResponse.error('Email already registered for another user'));
      }

      res.status(400).json(ApiResponse.error(`Error updating user: ${error.message}`));
    }
  }

  static async deleteUser(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const user = await UserService.deleteUser(id);

      res.status(200).json(
        ApiResponse.success(null, `User ${user.name} marked as deleted successfully (soft delete)`)
      );
    } catch (error: any) {
      console.error('Error deleting user:', error);

      if (error.message === 'User not found or already deleted') {
        return res.status(404).json(ApiResponse.error('User not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting user'));
    }
  }

  static async restoreUser(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const user = await UserService.restoreUser(id);

      res.status(200).json(
        ApiResponse.success(null, `User ${user.name} restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring user:', error);

      if (error.message === 'User not found') {
        return res.status(404).json(ApiResponse.error('User not found'));
      }

      if (error.message === 'User is not deleted') {
        return res.status(400).json(ApiResponse.error('User is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring user'));
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

      // Usar AuthService para alterar senha
      await AuthService.changePassword(id, oldPassword, newPassword);

      res.status(200).json(
        ApiResponse.success(null, 'Senha alterada com sucesso')
      );
    } catch (error: any) {
      console.error('Error changing password:', error);

      if (error.message === 'Usuário não encontrado') {
        return res.status(404).json(ApiResponse.error('Usuário não encontrado'));
      }

      if (error.message === 'Senha atual incorreta') {
        return res.status(400).json(ApiResponse.error('Senha atual incorreta'));
      }

      res.status(500).json(ApiResponse.error('Erro ao alterar senha'));
    }
  }
}