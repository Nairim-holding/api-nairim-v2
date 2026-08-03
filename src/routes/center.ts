import { CenterController } from '@/controllers/CenterController';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'financial-centers';

const router = Router();

router.get('/', canView(RESOURCE), CenterController.getCenters);
router.get('/filters', canView(RESOURCE), CenterController.getFilters);
router.post('/quick-create', canCreate(RESOURCE), CenterController.quickCreate);
router.get('/:id', canView(RESOURCE), CenterController.getCenterById);
router.post('/', canCreate(RESOURCE), CenterController.createCenter);
router.put('/:id', canEdit(RESOURCE), CenterController.updateCenter);
router.delete('/:id', canDelete(RESOURCE), CenterController.deleteCenter);
router.patch('/:id/restore', canEdit(RESOURCE), CenterController.restoreCenter);

export default router;
