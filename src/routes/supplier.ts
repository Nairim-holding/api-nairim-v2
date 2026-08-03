import { SupplierController } from '@/controllers/SupplierController';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'financial-suppliers';

const router = Router();

router.get('/', canView(RESOURCE), SupplierController.getSuppliers);
router.get('/filters', canView(RESOURCE), SupplierController.getFilters);
router.get('/:id', canView(RESOURCE), SupplierController.getSupplierById);
router.post('/', canCreate(RESOURCE), SupplierController.createSupplier);
router.post('/quick-create', canCreate(RESOURCE), SupplierController.quickCreate);
router.put('/:id', canEdit(RESOURCE), SupplierController.updateSupplier);
router.delete('/:id', canDelete(RESOURCE), SupplierController.deleteSupplier);
router.patch('/:id/restore', canEdit(RESOURCE), SupplierController.restoreSupplier);

export default router;
