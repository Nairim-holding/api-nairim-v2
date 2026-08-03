import { LeaseController } from '../controllers/LeaseController';
import {
  validateCreateLease,
  validateUpdateLease,
  validateGetLeases
} from '../middlewares/validation';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { upload } from '../utils/upload';
import { Router } from 'express';

const RESOURCE = 'leases';

const router = Router();

router.get('/', canView(RESOURCE), validateGetLeases, LeaseController.getLeases);
router.get('/filters', canView(RESOURCE), LeaseController.getLeaseFilters);
router.get('/:id/cancellation-preview', canView(RESOURCE), LeaseController.getCancellationPreview);
router.get('/:id', canView(RESOURCE), LeaseController.getLeaseById);
// Cancelar altera o estado da locação → edição, não exclusão
router.post('/:id/cancel', canEdit(RESOURCE), LeaseController.cancelLease);
router.post('/', canCreate(RESOURCE), validateCreateLease, LeaseController.createLease);
router.put('/:id', canEdit(RESOURCE), validateUpdateLease, LeaseController.updateLease);
router.delete('/:id/permanent', canDelete(RESOURCE), LeaseController.permanentlyDeleteLease);
router.delete('/:id', canDelete(RESOURCE), LeaseController.deleteLease);
router.patch('/:id/restore', canEdit(RESOURCE), LeaseController.restoreLease);

router.put(
  '/:id/documents',
  canEdit(RESOURCE),
  upload.fields([{ name: 'arquivosLocacao' }]),
  LeaseController.updateLeaseDocuments
);

export default router;
