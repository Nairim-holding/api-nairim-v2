import express from "express";
import { validateDashboardParams } from "../lib/validators/dashboard";
import { DashboardController } from "@/controllers/DashboardController";

const router = express.Router();

// Middleware de validação
const validateParams = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const validation = validateDashboardParams(req.query);
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors
    });
  }
  
  next();
};

// Rotas separadas
router.get("/financial", validateParams, DashboardController.getFinancial);
router.get("/portfolio", validateParams, DashboardController.getPortfolio);
router.get("/clients", validateParams, DashboardController.getClients);
router.get("/map", validateParams, DashboardController.getMap);

// Rota completa (opcional)
router.get("/all", validateParams, DashboardController.getAll);

export default router;