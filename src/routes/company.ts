import { Router } from 'express';
import { CompanyController } from '../controllers/CompanyController';
import { authenticateJWT, requireAdmin, requireSuperAdmin } from '../middlewares/auth';
import { requireTenant } from '../middlewares/tenant';
import { upload } from '../utils/upload';

const router = Router();

// ─── Branding (public + admin) ────────────────────────────────────────────
router.get('/branding', CompanyController.getPublicBranding);
router.get('/branding/me', authenticateJWT, requireTenant, CompanyController.getMyBranding);
router.put('/branding', authenticateJWT, requireTenant, requireAdmin, CompanyController.updateBranding);
router.post('/branding/logo', authenticateJWT, requireTenant, requireAdmin, upload.single('file'), CompanyController.uploadLogo);
router.post('/branding/favicon', authenticateJWT, requireTenant, requireAdmin, upload.single('file'), CompanyController.uploadFavicon);
router.post('/branding/logo-sidebar', authenticateJWT, requireTenant, requireAdmin, upload.single('file'), CompanyController.uploadLogoSidebar);
router.post('/branding/logo-dark', authenticateJWT, requireTenant, requireAdmin, upload.single('file'), CompanyController.uploadLogoDark);
router.post('/branding/og-image', authenticateJWT, requireTenant, requireAdmin, upload.single('file'), CompanyController.uploadOgImage);

// Troca o contexto de empresa emitindo novo JWT — sem re-login
router.post('/switch', authenticateJWT, CompanyController.switchCompany);

// ─── CRUD de Empresas (super admin apenas) ────────────────────────────────
router.get('/check-slug/:slug', authenticateJWT, requireSuperAdmin, CompanyController.checkSlugAvailability);
router.get('/list', authenticateJWT, requireSuperAdmin, CompanyController.listCompanies);
router.get('/list/filters', authenticateJWT, requireSuperAdmin, CompanyController.getCompanyFilters);
router.get('/:id', authenticateJWT, requireSuperAdmin, CompanyController.getCompanyById);
router.post('/', authenticateJWT, requireSuperAdmin, CompanyController.createCompany);
router.put('/:id', authenticateJWT, requireSuperAdmin, CompanyController.updateCompany);
router.delete('/:id', authenticateJWT, requireSuperAdmin, CompanyController.deleteCompany);
router.patch('/:id/restore', authenticateJWT, requireSuperAdmin, CompanyController.restoreCompany);

export default router;
