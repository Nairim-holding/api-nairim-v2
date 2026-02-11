import { TenantController } from '../controllers/TenantController';
import { 
  validateCreateTenant, 
  validateUpdateTenant, 
  validateGetTenants 
} from '../middlewares/validation';
import { Router } from 'express';

const router = Router();

router.get('/', validateGetTenants, TenantController.getTenants);
router.get('/filters', TenantController.getTenantFilters);
router.get('/suggestions/contacts', TenantController.getContactSuggestions);
router.get('/:id', TenantController.getTenantById);
router.post('/', validateCreateTenant, TenantController.createTenant);
router.put('/:id', validateUpdateTenant, TenantController.updateTenant);
router.delete('/:id', TenantController.deleteTenant);
router.patch('/:id/restore', TenantController.restoreTenant);

export default router;