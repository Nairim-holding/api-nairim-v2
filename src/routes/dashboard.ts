import express from "express";
import { validateDashboardParams } from "../lib/validators/dashboard";
import { DashboardController } from "@/controllers/DashboardController";
import { canView } from "../middlewares/permission";

const RESOURCE = 'dashboard';

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
router.get("/financial", canView(RESOURCE), validateParams, DashboardController.getFinancial);
router.get("/portfolio", canView(RESOURCE), validateParams, DashboardController.getPortfolio);
router.get("/clients", canView(RESOURCE), validateParams, DashboardController.getClients);
router.get("/tenant-tenure", canView(RESOURCE), validateParams, DashboardController.getTenantTenure);
router.get("/map", canView(RESOURCE), validateParams, DashboardController.getMap);

// Sem validateParams: consumo de armazenamento é um retrato do momento, não usa período.
router.get("/storage", canView(RESOURCE), DashboardController.getStorage);
router.get("/database", canView(RESOURCE), DashboardController.getDatabaseUsage);

// Rota completa (opcional)
router.get("/all", canView(RESOURCE), validateParams, DashboardController.getAll);

export default router;
