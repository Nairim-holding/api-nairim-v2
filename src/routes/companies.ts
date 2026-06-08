import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth';
import { CompanyController } from '../controllers/CompanyController';
import { upload } from '../utils/upload';

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

// Upload de assets de branding para uma empresa específica (admin gerenciando
// outras empresas — distinto de /company/branding/* que opera sobre o company_id do JWT).
router.post('/:id/branding/logo', requireAdmin, upload.single('file'), CompanyController.uploadLogoForCompany);
router.post('/:id/branding/favicon', requireAdmin, upload.single('file'), CompanyController.uploadFaviconForCompany);
router.post('/:id/branding/logo-sidebar', requireAdmin, upload.single('file'), CompanyController.uploadLogoSidebarForCompany);
router.post('/:id/branding/logo-dark', requireAdmin, upload.single('file'), CompanyController.uploadLogoDarkForCompany);
router.post('/:id/branding/og-image', requireAdmin, upload.single('file'), CompanyController.uploadOgImageForCompany);

export default router;
