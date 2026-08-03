import { AgencyController } from '@/controllers/AgencyController';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'agencies';

const router = Router();

router.get('/', canView(RESOURCE), AgencyController.getAgencies);
router.get('/filters', canView(RESOURCE), AgencyController.getAgencyFilters);
router.get('/suggestions/contacts', canView(RESOURCE), AgencyController.getContactSuggestions);
router.get('/:id', canView(RESOURCE), AgencyController.getAgencyById);
router.post('/', canCreate(RESOURCE), AgencyController.createAgency);
router.put('/:id', canEdit(RESOURCE), AgencyController.updateAgency);
router.delete('/:id', canDelete(RESOURCE), AgencyController.deleteAgency);
router.patch('/:id/restore', canEdit(RESOURCE), AgencyController.restoreAgency);

export default router;
