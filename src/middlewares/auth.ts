import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../utils/api-response';
import { env } from '@/env';

// Middleware para verificar token JWT
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(
      ApiResponse.error('Acesso negado. Token não fornecido.')
    );
  }

  const token = authHeader.split(' ')[1];
  const secretKey = env.JWT_SECRET as string;

  if (!secretKey) {
    return res.status(500).json(
      ApiResponse.error('Erro interno do servidor')
    );
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    (req as any).user = decoded; // Adicionar usuário decodificado ao request
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(
        ApiResponse.error('Token expirado. Faça login novamente.')
      );
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json(
        ApiResponse.error('Token inválido.')
      );
    }

    return res.status(500).json(
      ApiResponse.error('Erro ao verificar token')
    );
  }
};

// Middleware para verificar se usuário é admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json(
      ApiResponse.error('Usuário não autenticado')
    );
  }

  // Verificar se o usuário tem role de administrador
  // Dependendo de como seu payload JWT é estruturado
  if (user.role !== 'administrador' && user.role !== 'ADMIN') {
    return res.status(403).json(
      ApiResponse.error('Acesso negado. Permissão de administrador necessária.')
    );
  }

  next();
};

// Middleware para verificar se usuário é o próprio ou admin
export const requireSelfOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const requestedUserId = req.params.id;
  
  if (!user) {
    return res.status(401).json(
      ApiResponse.error('Usuário não autenticado')
    );
  }

  // Se for admin, permite acesso
  if (user.role === 'administrador' || user.role === 'ADMIN') {
    return next();
  }

  // Se não for admin, só pode acessar seu próprio recurso
  if (user.id !== requestedUserId) {
    return res.status(403).json(
      ApiResponse.error('Acesso negado. Você só pode acessar seus próprios dados.')
    );
  }

  next();
};