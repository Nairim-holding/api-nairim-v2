import { PropertyTypeController } from '../controllers/PropertyTypeController';
import { 
  validateCreatePropertyType, 
  validateUpdatePropertyType, 
  validateGetPropertyTypes 
} from '../middlewares/validation';
import { Router } from 'express';

const router = Router();

router.get('/', validateGetPropertyTypes, PropertyTypeController.getPropertyTypes);
router.get('/filters', PropertyTypeController.getPropertyTypeFilters);
router.get('/:id', PropertyTypeController.getPropertyTypeById);
router.post('/', validateCreatePropertyType, PropertyTypeController.createPropertyType);
router.put('/:id', validateUpdatePropertyType, PropertyTypeController.updatePropertyType);
router.delete('/:id', PropertyTypeController.deletePropertyType);
router.patch('/:id/restore', PropertyTypeController.restorePropertyType);

export default router;