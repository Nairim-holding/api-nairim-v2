
import { FinancialInstitutionController } from '@/controllers/financialIntitucion';
import { Router } from 'express';

const router = Router();

router.get('/', FinancialInstitutionController.getInstitutions);
router.get('/filters', FinancialInstitutionController.getFilters);
router.get('/:id', FinancialInstitutionController.getInstitutionById);
router.post('/', FinancialInstitutionController.createInstitution);
router.put('/:id', FinancialInstitutionController.updateInstitution);
router.delete('/:id', FinancialInstitutionController.deleteInstitution);
router.patch('/:id/restore', FinancialInstitutionController.restoreInstitution);

export default router;