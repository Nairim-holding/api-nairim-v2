// src/controller/AuthController.ts
import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";
import { ApiResponse } from "../utils/api-response";
import { AuthValidator } from "../lib/validators/auth";

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Validar entrada
      const validation = AuthValidator.validateLogin(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      // Autenticar usuário
      const result = await AuthService.login(email, password);

      return res.status(200).json(
        ApiResponse.success(result, 'Login realizado com sucesso!')
      );

    } catch (error: any) {
      console.error('❌ Error in AuthController.login:', error);
      
      if (error.message === 'Credenciais inválidas') {
        return res.status(401).json(
          ApiResponse.error('Email ou senha incorretos')
        );
      }

      return res.status(500).json(
        ApiResponse.error(error.message || 'Erro ao realizar login')
      );
    }
  }

  static async verifyToken(req: Request, res: Response) {
    try {
      const { token } = req.body;

      // Validar entrada
      const validation = AuthValidator.validateToken(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      // Verificar token
      const result = await AuthService.verifyToken(token);

      return res.status(200).json(
        ApiResponse.success(result, result.message)
      );

    } catch (error: any) {
      console.error('❌ Error in AuthController.verifyToken:', error);
      
      if (error.message === 'Token expirado' || error.message === 'Token inválido') {
        return res.status(401).json(
          ApiResponse.error(error.message)
        );
      }

      return res.status(500).json(
        ApiResponse.error(error.message || 'Erro ao verificar token')
      );
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      // Em uma implementação mais completa, poderíamos adicionar o token a uma blacklist
      // Por enquanto, apenas retornamos sucesso
      
      return res.status(200).json(
        ApiResponse.success(null, 'Logout realizado com sucesso')
      );

    } catch (error: any) {
      console.error('❌ Error in AuthController.logout:', error);
      return res.status(500).json(
        ApiResponse.error('Erro ao realizar logout')
      );
    }
  }

  static async refreshToken(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json(
          ApiResponse.error('Token é obrigatório')
        );
      }

      const result = await AuthService.refreshToken(token);

      return res.status(200).json(
        ApiResponse.success(result, 'Token renovado com sucesso')
      );

    } catch (error: any) {
      console.error('❌ Error in AuthController.refreshToken:', error);
      
      if (error.message === 'Token expirado, faça login novamente') {
        return res.status(401).json(
          ApiResponse.error(error.message)
        );
      }

      return res.status(500).json(
        ApiResponse.error(error.message || 'Erro ao renovar token')
      );
    }
  }

  static async getCurrentUser(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(
          ApiResponse.error('Token não fornecido')
        );
      }

      const token = authHeader.split(' ')[1];
      const user = await AuthService.getCurrentUser(token);

      return res.status(200).json(
        ApiResponse.success(user, 'Usuário atual recuperado com sucesso')
      );

    } catch (error: any) {
      console.error('❌ Error in AuthController.getCurrentUser:', error);
      
      if (error.message === 'Token expirado' || error.message === 'Token inválido') {
        return res.status(401).json(
          ApiResponse.error(error.message)
        );
      }

      return res.status(500).json(
        ApiResponse.error(error.message || 'Erro ao recuperar usuário atual')
      );
    }
  }

  static async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json(
          ApiResponse.error('Email é obrigatório')
        );
      }

      const result = await AuthService.requestPasswordReset(email);

      return res.status(200).json(
        ApiResponse.success(result, result.message)
      );

    } catch (error: any) {
      console.error('❌ Error in AuthController.requestPasswordReset:', error);
      return res.status(500).json(
        ApiResponse.error(error.message || 'Erro ao solicitar redefinição de senha')
      );
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json(
          ApiResponse.error('Token e nova senha são obrigatórios')
        );
      }

      if (newPassword.length < 6) {
        return res.status(400).json(
          ApiResponse.error('Nova senha deve ter no mínimo 6 caracteres')
        );
      }

      const result = await AuthService.resetPassword(token, newPassword);

      return res.status(200).json(
        ApiResponse.success(result, result.message)
      );

    } catch (error: any) {
      console.error('❌ Error in AuthController.resetPassword:', error);
      
      if (error.message.includes('Token') || error.message.includes('expirado') || error.message.includes('inválido')) {
        return res.status(400).json(
          ApiResponse.error(error.message)
        );
      }

      return res.status(500).json(
        ApiResponse.error(error.message || 'Erro ao redefinir senha')
      );
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const { oldPassword, newPassword } = req.body;

      if (!userId) {
        return res.status(400).json(
          ApiResponse.error('ID do usuário é obrigatório')
        );
      }

      if (!oldPassword || !newPassword) {
        return res.status(400).json(
          ApiResponse.error('Senha atual e nova senha são obrigatórias')
        );
      }

      if (newPassword.length < 6) {
        return res.status(400).json(
          ApiResponse.error('Nova senha deve ter no mínimo 6 caracteres')
        );
      }

      await AuthService.changePassword(userId.toString(), oldPassword, newPassword);

      return res.status(200).json(
        ApiResponse.success(null, 'Senha alterada com sucesso')
      );

    } catch (error: any) {
      console.error('❌ Error in AuthController.changePassword:', error);
      
      if (error.message === 'Usuário não encontrado') {
        return res.status(404).json(
          ApiResponse.error('Usuário não encontrado')
        );
      }

      if (error.message === 'Senha atual incorreta') {
        return res.status(400).json(
          ApiResponse.error('Senha atual incorreta')
        );
      }

      return res.status(500).json(
        ApiResponse.error(error.message || 'Erro ao alterar senha')
      );
    }
  }
}