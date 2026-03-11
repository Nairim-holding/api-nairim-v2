import { CenterController } from '@/controllers/CenterController';
import { Router } from 'express';

const router = Router();

router.get('/', CenterController.getCenters);
router.get('/filters', CenterController.getFilters);
router.get('/:id', CenterController.getCenterById);
router.post('/', CenterController.createCenter);
router.put('/:id', CenterController.updateCenter);
router.delete('/:id', CenterController.deleteCenter);
router.patch('/:id/restore', CenterController.restoreCenter);

export default router;