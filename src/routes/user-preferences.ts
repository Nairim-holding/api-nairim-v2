import { Router } from 'express';
import { UserPreferencesController } from '../controllers/UserPreferencesController';
import { authenticateJWT } from '../middlewares/auth';
import { validateGetColumnPreferences, validateSaveColumnPreferences } from '../middlewares/validation';

const router = Router();

// Rotas de preferências do usuário (protegidas por autenticação)
router.get('/column-order', authenticateJWT, validateGetColumnPreferences, UserPreferencesController.getColumnOrder);
router.post('/column-order', authenticateJWT, validateSaveColumnPreferences, UserPreferencesController.saveColumnOrder);

export default router;
