import { OwnerController } from '../controllers/OwnerController';
import {
  validateCreateOwner,
  validateUpdateOwner,
  validateGetOwners
} from '../middlewares/validation';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'owners';

const router = Router();

router.get('/', canView(RESOURCE), validateGetOwners, OwnerController.getOwners);
router.get('/filters', canView(RESOURCE), OwnerController.getOwnerFilters);
router.get('/:id', canView(RESOURCE), OwnerController.getOwnerById);
router.get('/suggestions/contacts', canView(RESOURCE), OwnerController.getContactSuggestions);
router.post('/', canCreate(RESOURCE), validateCreateOwner, OwnerController.createOwner);
router.put('/:id', canEdit(RESOURCE), validateUpdateOwner, OwnerController.updateOwner);
router.delete('/:id', canDelete(RESOURCE), OwnerController.deleteOwner);
router.patch('/:id/restore', canEdit(RESOURCE), OwnerController.restoreOwner);

export default router;
