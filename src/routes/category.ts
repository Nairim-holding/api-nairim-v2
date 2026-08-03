import { CategoryController } from '@/controllers/CategoryController';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

// Categorias e subcategorias são um único item de menu ("Categorias/Subcategorias")
const RESOURCE = 'financial-categories';

const router = Router();

router.get('/', canView(RESOURCE), CategoryController.getCategories);
router.get('/filters', canView(RESOURCE), CategoryController.getFilters);
router.post('/quick-create', canCreate(RESOURCE), CategoryController.quickCreate);
router.get('/:id', canView(RESOURCE), CategoryController.getCategoryById);
router.post('/', canCreate(RESOURCE), CategoryController.createCategory);
router.put('/:id', canEdit(RESOURCE), CategoryController.updateCategory);
router.delete('/:id', canDelete(RESOURCE), CategoryController.deleteCategory);
router.patch('/:id/restore', canEdit(RESOURCE), CategoryController.restoreCategory);

export default router;
