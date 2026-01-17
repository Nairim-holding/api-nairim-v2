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

      const sortOptions = {
        sort_id: ValidationUtil.parseStringParam(req.query?.sort_id),
        sort_name: ValidationUtil.parseStringParam(req.query?.sort_name),
        sort_email: ValidationUtil.parseStringParam(req.query?.sort_email),
        sort_birth_date: ValidationUtil.parseStringParam(req.query?.sort_birth_date),
        sort_gender: ValidationUtil.parseStringParam(req.query?.sort_gender),
        sort_role: ValidationUtil.parseStringParam(req.query?.sort_role),
        sort_created_at: ValidationUtil.parseStringParam(req.query?.sort_created_at),
        sort_updated_at: ValidationUtil.parseStringParam(req.query?.sort_updated_at),
      };

      // Extrair filtros dos query params
      const filters: Record<string, any> = {};
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (!['limit', 'page', 'search', 'includeInactive'].includes(key) && 
            !key.startsWith('sort_')) {
          filters[key] = value;
        }
      });

      const validation = UserValidator.validateQueryParams(req.query);
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

      res.status(200).json(
        ApiResponse.paginated(
          result.data,
          result.count,
          result.currentPage,
          result.totalPages,
          limit,
          'Users retrieved successfully'
        )
      );
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
      const filters = await UserService.getUserFilters();
      res.status(200).json(
        ApiResponse.success(filters, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('Error getting filters:', error);
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