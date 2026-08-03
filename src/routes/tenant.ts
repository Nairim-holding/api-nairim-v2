import { TenantController } from '../controllers/TenantController';
import {
  validateCreateTenant,
  validateUpdateTenant,
  validateGetTenants
} from '../middlewares/validation';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'tenants';

const router = Router();

router.get('/', canView(RESOURCE), validateGetTenants, TenantController.getTenants);
router.get('/filters', canView(RESOURCE), TenantController.getTenantFilters);
router.get('/suggestions/contacts', canView(RESOURCE), TenantController.getContactSuggestions);
router.get('/next-internal-code', canView(RESOURCE), TenantController.getNextInternalCode);
router.get('/:id', canView(RESOURCE), TenantController.getTenantById);
router.post('/', canCreate(RESOURCE), validateCreateTenant, TenantController.createTenant);
router.put('/:id', canEdit(RESOURCE), validateUpdateTenant, TenantController.updateTenant);
router.delete('/:id', canDelete(RESOURCE), TenantController.deleteTenant);
router.patch('/:id/restore', canEdit(RESOURCE), TenantController.restoreTenant);

export default router;
