// src/services/AuthService.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { env } from '@/env';

export class AuthService {
  static async login(email: string, password: string) {
    try {
      console.log(`🔐 Attempting login for email: ${email}`);
      
      const user = await prisma.user.findFirst({
        where: { email, deleted_at: null },
        select: {
          id: true, name: true, email: true, password: true, role: true, created_at: true
        }
      });

      if (!user) {
        console.log('❌ User not found');
        throw new Error('Credenciais inválidas');
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        console.log('❌ Invalid password');
        throw new Error('Credenciais inválidas');
      }

      const secretKey = env.JWT_SECRET as string;
      if (!secretKey) throw new Error('JWT_SECRET_KEY não configurada');

      const roleMap: Record<string, string> = {
        'ADMIN': 'administrador',
        'DEFAULT': 'usuário'
      };

      const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleMap[user.role] || user.role
      };

      const token = jwt.sign(payload, secretKey, { expiresIn: '2h' });

      console.log(`✅ Login successful for user: ${user.email}`);

      const { password: _, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token,
        expiresIn: '2h'
      };

    } catch (error: any) {
      console.error('❌ Error in AuthService.login:', error);
      throw error;
    }
  }

  static async verifyToken(token: string) {
    try {
      console.log(`🔍 Verifying token...`);
      
      const secretKey = env.JWT_SECRET as string;
      if (!secretKey) {
        throw new Error('JWT_SECRET_KEY não configurada');
      }

      const decoded = jwt.verify(token, secretKey);
      
      console.log(`✅ Token is valid`);
      return {
        valid: true,
        decoded,
        message: 'Token válido'
      };

    } catch (error: any) {
      console.error('❌ Error in AuthService.verifyToken:', error);
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expirado');
      }
      
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token inválido');
      }

      throw new Error('Erro ao verificar token');
    }
  }

  static async refreshToken(oldToken: string) {
    try {
      console.log(`🔄 Refreshing token...`);
      
      const secretKey = env.JWT_SECRET as string;
      if (!secretKey) throw new Error('JWT_SECRET_KEY não configurada');

      const decoded: any = jwt.verify(oldToken, secretKey);
      
      const payload = {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role
      };

      // ✅ MUDANÇA AQUI: Alterado de '8h' para '2h'
      const newToken = jwt.sign(payload, secretKey, { expiresIn: '2h' });

      console.log(`✅ Token refreshed for user: ${decoded.email}`);
      
      return {
        token: newToken,
        expiresIn: '2h' // ✅ MUDANÇA AQUI
      };

    } catch (error: any) {
      console.error('❌ Error in AuthService.refreshToken:', error);
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expirado, faça login novamente');
      }
      
      throw new Error('Erro ao renovar token');
    }
  }

  static async getCurrentUser(token: string) {
    try {
      console.log(`👤 Getting current user from token...`);
      
      const secretKey = env.JWT_SECRET as string;
      if (!secretKey) {
        throw new Error('JWT_SECRET_KEY não configurada');
      }

      // Verificar token
      const decoded: any = jwt.verify(token, secretKey);
      
      // Buscar usuário atualizado do banco
      const user = await prisma.user.findUnique({
        where: { 
          id: decoded.id,
          deleted_at: null
        },
        select: {
          id: true,
          name: true,
          email: true,
          birth_date: true,
          gender: true,
          role: true,
          created_at: true,
          updated_at: true
        }
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      console.log(`✅ Current user retrieved: ${user.email}`);
      
      return user;

    } catch (error: any) {
      console.error('❌ Error in AuthService.getCurrentUser:', error);
      throw error;
    }
  }

  static async changePassword(userId: string, oldPassword: string, newPassword: string) {
    try {
      console.log(`🔐 Changing password for user: ${userId}`);
      
      // Buscar usuário
      const user = await prisma.user.findUnique({
        where: { 
          id: userId,
          deleted_at: null
        }
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar senha atual
      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!passwordMatch) {
        throw new Error('Senha atual incorreta');
      }

      // Hash nova senha
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Atualizar senha
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      console.log(`✅ Password changed for user: ${userId}`);
      return true;

    } catch (error: any) {
      console.error(`❌ Error changing password for user ${userId}:`, error);
      throw error;
    }
  }

  static async requestPasswordReset(email: string) {
    try {
      console.log(`📧 Requesting password reset for email: ${email}`);
      
      // Verificar se usuário existe
      const user = await prisma.user.findFirst({
        where: { 
          email,
          deleted_at: null
        }
      });

      if (!user) {
        // Não revelar que o usuário não existe por segurança
        console.log(`⚠️ Password reset requested for non-existent email: ${email}`);
        return {
          success: true,
          message: 'Se o email existir em nosso sistema, você receberá instruções para redefinir sua senha.'
        };
      }

      // Gerar token de reset
      const secretKey = env.JWT_SECRET as string;
      const resetToken = jwt.sign(
        { id: user.id, email: user.email, type: 'password_reset' },
        secretKey,
        { expiresIn: '1h' }
      );

      // Aqui você implementaria o envio de email
      console.log(`✅ Reset token generated for ${email}: ${resetToken}`);
      
      // Em produção, enviar email com o link de reset
      return {
        success: true,
        message: 'Se o email existir em nosso sistema, você receberá instruções para redefinir sua senha.',
        resetToken // Em produção, não retornar o token na API
      };

    } catch (error: any) {
      console.error('❌ Error in AuthService.requestPasswordReset:', error);
      throw error;
    }
  }

  static async resetPassword(token: string, newPassword: string) {
    try {
      console.log(`🔄 Resetting password with token...`);
      
      const secretKey = env.JWT_SECRET as string;
      
      // Verificar token
      const decoded: any = jwt.verify(token, secretKey);
      
      if (decoded.type !== 'password_reset') {
        throw new Error('Token inválido para redefinição de senha');
      }

      // Buscar usuário
      const user = await prisma.user.findUnique({
        where: { 
          id: decoded.id,
          deleted_at: null
        }
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Hash nova senha
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Atualizar senha
      await prisma.user.update({
        where: { id: decoded.id },
        data: { password: hashedPassword }
      });

      console.log(`✅ Password reset for user: ${user.email}`);
      
      return {
        success: true,
        message: 'Senha redefinida com sucesso'
      };

    } catch (error: any) {
      console.error('❌ Error in AuthService.resetPassword:', error);
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token de redefinição expirado');
      }
      
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token de redefinição inválido');
      }

      throw error;
    }
  }
}