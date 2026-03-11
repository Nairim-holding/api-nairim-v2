import { SupplierController } from '@/controllers/SupplierController';
import { Router } from 'express';

const router = Router();

router.get('/', SupplierController.getSuppliers);
router.get('/filters', SupplierController.getFilters);
router.get('/:id', SupplierController.getSupplierById);
router.post('/', SupplierController.createSupplier);
router.put('/:id', SupplierController.updateSupplier);
router.delete('/:id', SupplierController.deleteSupplier);
router.patch('/:id/restore', SupplierController.restoreSupplier);

export default router;