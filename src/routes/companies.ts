import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth';
import { CompanyController } from '../controllers/CompanyController';

// Rota /companies — usada pelo DataTable do frontend (resource="companies").
// Registrada após o middleware global authenticateJWT + requireTenant.
const router = Router();

router.get('/filters', requireAdmin, CompanyController.getCompanyFilters);
router.get('/', requireAdmin, CompanyController.listCompanies);
router.get('/:id', requireAdmin, CompanyController.getCompanyById);
router.post('/', requireAdmin, CompanyController.createCompany);
router.put('/:id', requireAdmin, CompanyController.updateCompany);
router.delete('/:id', requireAdmin, CompanyController.deleteCompany);
router.patch('/:id/restore', requireAdmin, CompanyController.restoreCompany);

export default router;
