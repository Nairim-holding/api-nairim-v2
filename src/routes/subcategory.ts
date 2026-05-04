import { SubcategoryController } from '@/controllers/SubcategoryController';
import { Router } from 'express';

const router = Router();

router.get('/', SubcategoryController.getSubcategories);
router.get('/filters', SubcategoryController.getFilters);
router.post('/quick-create', SubcategoryController.quickCreate);
router.get('/:id', SubcategoryController.getSubcategoryById);
router.post('/', SubcategoryController.createSubcategory);
router.put('/:id', SubcategoryController.updateSubcategory);
router.delete('/:id', SubcategoryController.deleteSubcategory);
router.patch('/:id/restore', SubcategoryController.restoreSubcategory);

export default router;