import { LeaseController } from '../controllers/LeaseController';
import { 
  validateCreateLease, 
  validateUpdateLease, 
  validateGetLeases 
} from '../middlewares/validation';
import { Router } from 'express';

const router = Router();

router.get('/', validateGetLeases, LeaseController.getLeases);
router.get('/filters', LeaseController.getLeaseFilters);
router.get('/:id', LeaseController.getLeaseById);
router.post('/', validateCreateLease, LeaseController.createLease);
router.put('/:id', validateUpdateLease, LeaseController.updateLease);
router.delete('/:id', LeaseController.deleteLease);
router.patch('/:id/restore', LeaseController.restoreLease);

export default router;