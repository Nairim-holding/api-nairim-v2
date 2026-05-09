import { Router } from 'express';
import { PlanningController } from '@/controllers/PlanningController';
import { authenticateJWT } from '@/middlewares/auth';
import { validatePlanningUpsert, validatePlanningQuery, validateDashboardQuery } from '@/middlewares/validation';

const router = Router();

router.use(authenticateJWT);

router.get('/dashboard', validateDashboardQuery, PlanningController.dashboard);
router.get('/', validatePlanningQuery, PlanningController.list);
router.get('/:id', PlanningController.getById);
router.post('/', validatePlanningUpsert, PlanningController.upsert);
router.delete('/:id', PlanningController.remove);

export default router;
