import { AgencyController } from '@/controllers/AgencyController';
import { Router } from 'express';

const router = Router();

router.get('/', AgencyController.getAgencies);
router.get('/filters', AgencyController.getAgencyFilters);
router.get('/:id', AgencyController.getAgencyById);
router.post('/', AgencyController.createAgency);
router.put('/:id', AgencyController.updateAgency);
router.delete('/:id', AgencyController.deleteAgency);
router.patch('/:id/restore', AgencyController.restoreAgency);

export default router;