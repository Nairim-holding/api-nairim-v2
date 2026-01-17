// src/routes/auth.ts
import express from "express";
import { AuthValidator } from "../lib/validators/auth";
import { ApiResponse } from "../utils/api-response";
import { AuthController } from "@/controllers/AuthController";

const router = express.Router();

// Middleware de validação para login
const validateLogin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const validation = AuthValidator.validateLogin(req.body);
  
  if (!validation.isValid) {
    return res.status(400).json(
      ApiResponse.error('Erro de validação', validation.errors)
    );
  }
  
  next();
};

// Middleware de validação para token
const validateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const validation = AuthValidator.validateToken(req.body);
  
  if (!validation.isValid) {
    return res.status(400).json(
      ApiResponse.error('Erro de validação', validation.errors)
    );
  }
  
  next();
};

// Middleware de autenticação (verifica token)
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(
      ApiResponse.error('Token não fornecido')
    );
  }

  const token = authHeader.split(' ')[1];
  
  // Adicionar token ao request para uso nos controllers
  (req as any).token = token;
  
  next();
};

// Rotas públicas
router.post("/login", validateLogin, AuthController.login);
router.post("/verify-token", validateToken, AuthController.verifyToken);
router.post("/logout", AuthController.logout);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/request-password-reset", AuthController.requestPasswordReset);
router.post("/reset-password", AuthController.resetPassword);

// Rotas protegidas (requerem token)
router.get("/me", authenticateToken, AuthController.getCurrentUser);
router.post("/change-password/:id", authenticateToken, AuthController.changePassword);

export default router;