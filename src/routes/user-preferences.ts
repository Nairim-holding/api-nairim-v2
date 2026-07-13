import { Router } from 'express';
import { UserPreferencesController } from '../controllers/UserPreferencesController';
import { authenticateJWT } from '../middlewares/auth';
import {
  validateGetColumnPreferences,
  validateSaveColumnPreferences,
  validateGetDashboardLayout,
  validateSaveDashboardLayout
} from '../middlewares/validation';

const router = Router();

// Rotas de preferências do usuário (protegidas por autenticação)
router.get('/column-order', authenticateJWT, validateGetColumnPreferences, UserPreferencesController.getColumnOrder);
router.post('/column-order', authenticateJWT, validateSaveColumnPreferences, UserPreferencesController.saveColumnOrder);

router.get('/dashboard-layout', authenticateJWT, validateGetDashboardLayout, UserPreferencesController.getDashboardLayout);
router.post('/dashboard-layout', authenticateJWT, validateSaveDashboardLayout, UserPreferencesController.saveDashboardLayout);

export default router;
