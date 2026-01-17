import { OwnerController } from '../controllers/OwnerController';
import { 
  validateCreateOwner, 
  validateUpdateOwner, 
  validateGetOwners 
} from '../middlewares/validation';
import { Router } from 'express';

const router = Router();

router.get('/', validateGetOwners, OwnerController.getOwners);
router.get('/filters', OwnerController.getOwnerFilters);
router.get('/:id', OwnerController.getOwnerById);
router.post('/', validateCreateOwner, OwnerController.createOwner);
router.put('/:id', validateUpdateOwner, OwnerController.updateOwner);
router.delete('/:id', OwnerController.deleteOwner);
router.patch('/:id/restore', OwnerController.restoreOwner);

export default router;