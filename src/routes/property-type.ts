import { PropertyTypeController } from '../controllers/PropertyTypeController';
import {
  validateCreatePropertyType,
  validateUpdatePropertyType,
  validateGetPropertyTypes
} from '../middlewares/validation';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'property-types';

const router = Router();

router.get('/', canView(RESOURCE), validateGetPropertyTypes, PropertyTypeController.getPropertyTypes);
router.get('/filters', canView(RESOURCE), PropertyTypeController.getPropertyTypeFilters);
router.get('/:id', canView(RESOURCE), PropertyTypeController.getPropertyTypeById);
router.post('/', canCreate(RESOURCE), validateCreatePropertyType, PropertyTypeController.createPropertyType);
router.put('/:id', canEdit(RESOURCE), validateUpdatePropertyType, PropertyTypeController.updatePropertyType);
router.delete('/:id', canDelete(RESOURCE), PropertyTypeController.deletePropertyType);
router.patch('/:id/restore', canEdit(RESOURCE), PropertyTypeController.restorePropertyType);

export default router;
