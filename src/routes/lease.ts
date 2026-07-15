import { LeaseController } from '../controllers/LeaseController';
import { 
  validateCreateLease, 
  validateUpdateLease, 
  validateGetLeases 
} from '../middlewares/validation';
import { upload } from '../utils/upload';
import { Router } from 'express';

const router = Router();

router.get('/', validateGetLeases, LeaseController.getLeases);
router.get('/filters', LeaseController.getLeaseFilters);
router.get('/:id/cancellation-preview', LeaseController.getCancellationPreview);
router.get('/:id', LeaseController.getLeaseById);
router.post('/:id/cancel', LeaseController.cancelLease);
router.post('/', validateCreateLease, LeaseController.createLease);
router.put('/:id', validateUpdateLease, LeaseController.updateLease);
router.delete('/:id/permanent', LeaseController.permanentlyDeleteLease);
router.delete('/:id', LeaseController.deleteLease);
router.patch('/:id/restore', LeaseController.restoreLease);

router.put(
  '/:id/documents',
  upload.fields([{ name: 'arquivosLocacao' }]),
  LeaseController.updateLeaseDocuments
);

export default router;