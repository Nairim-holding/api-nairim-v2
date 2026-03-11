import { CategoryController } from '@/controllers/CategoryController';
import { Router } from 'express';

const router = Router();

router.get('/', CategoryController.getCategories);
router.get('/filters', CategoryController.getFilters);
router.get('/:id', CategoryController.getCategoryById);
router.post('/', CategoryController.createCategory);
router.put('/:id', CategoryController.updateCategory);
router.delete('/:id', CategoryController.deleteCategory);
router.patch('/:id/restore', CategoryController.restoreCategory);

export default router;