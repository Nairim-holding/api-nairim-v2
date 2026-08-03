
import { FinancialInstitutionController } from '@/controllers/financialIntitucion';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'financial-institutions';

const router = Router();

router.get('/', canView(RESOURCE), FinancialInstitutionController.getInstitutions);
router.get('/filters', canView(RESOURCE), FinancialInstitutionController.getFilters);
router.get('/balance-summary', canView(RESOURCE), FinancialInstitutionController.getBalanceSummary);
router.post('/quick-create', canCreate(RESOURCE), FinancialInstitutionController.quickCreate);
router.get('/:id', canView(RESOURCE), FinancialInstitutionController.getInstitutionById);
router.post('/', canCreate(RESOURCE), FinancialInstitutionController.createInstitution);
router.put('/:id', canEdit(RESOURCE), FinancialInstitutionController.updateInstitution);
router.delete('/:id', canDelete(RESOURCE), FinancialInstitutionController.deleteInstitution);
router.patch('/:id/restore', canEdit(RESOURCE), FinancialInstitutionController.restoreInstitution);

export default router;
