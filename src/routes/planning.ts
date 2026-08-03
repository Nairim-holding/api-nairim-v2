import { Router } from 'express';
import { PlanningController } from '@/controllers/PlanningController';
import { authenticateJWT } from '@/middlewares/auth';
import { canView, canCreate, canEdit, canDelete } from '@/middlewares/permission';
import { validatePlanningUpsert, validatePlanningQuery, validateDashboardQuery } from '@/middlewares/validation';

const RESOURCE = 'planning';

const router = Router();

router.use(authenticateJWT);

router.get('/dashboard', canView(RESOURCE), validateDashboardQuery, PlanningController.dashboard);
router.get('/', canView(RESOURCE), validatePlanningQuery, PlanningController.list);
router.get('/:id', canView(RESOURCE), PlanningController.getById);
// upsert cria ou atualiza: exige as duas permissões
router.post('/', canCreate(RESOURCE), canEdit(RESOURCE), validatePlanningUpsert, PlanningController.upsert);
router.post('/create', canCreate(RESOURCE), validatePlanningUpsert, PlanningController.createStrict);
router.put('/:id', canEdit(RESOURCE), validatePlanningUpsert, PlanningController.updateStrict);
router.delete('/:id', canDelete(RESOURCE), PlanningController.remove);

export default router;
