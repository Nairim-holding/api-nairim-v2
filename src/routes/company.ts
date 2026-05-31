import { Router } from 'express';
import { CompanyController } from '../controllers/CompanyController';
import { authenticateJWT, requireAdmin } from '../middlewares/auth';
import { requireTenant } from '../middlewares/tenant';
import { upload } from '../utils/upload';

const router = Router();

// ─── Branding (public + admin) ────────────────────────────────────────────
router.get('/branding', CompanyController.getPublicBranding);
router.get('/branding/me', authenticateJWT, requireTenant, CompanyController.getMyBranding);
router.put('/branding', authenticateJWT, requireTenant, requireAdmin, CompanyController.updateBranding);
router.post('/branding/logo', authenticateJWT, requireTenant, requireAdmin, upload.single('file'), CompanyController.uploadLogo);
router.post('/branding/favicon', authenticateJWT, requireTenant, requireAdmin, upload.single('file'), CompanyController.uploadFavicon);

// ─── CRUD de Empresas (admin) ─────────────────────────────────────────────
router.get('/list', authenticateJWT, requireTenant, requireAdmin, CompanyController.listCompanies);
router.get('/list/filters', authenticateJWT, requireTenant, requireAdmin, CompanyController.getCompanyFilters);
router.get('/:id', authenticateJWT, requireTenant, requireAdmin, CompanyController.getCompanyById);
router.post('/', authenticateJWT, requireTenant, requireAdmin, CompanyController.createCompany);
router.put('/:id', authenticateJWT, requireTenant, requireAdmin, CompanyController.updateCompany);
router.delete('/:id', authenticateJWT, requireTenant, requireAdmin, CompanyController.deleteCompany);
router.patch('/:id/restore', authenticateJWT, requireTenant, requireAdmin, CompanyController.restoreCompany);

export default router;
