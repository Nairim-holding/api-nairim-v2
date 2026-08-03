import { SubcategoryController } from '@/controllers/SubcategoryController';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

// Mesmo recurso de menu que /financial-category
const RESOURCE = 'financial-categories';

const router = Router();

router.get('/', canView(RESOURCE), SubcategoryController.getSubcategories);
router.get('/filters', canView(RESOURCE), SubcategoryController.getFilters);
router.post('/quick-create', canCreate(RESOURCE), SubcategoryController.quickCreate);
router.get('/:id', canView(RESOURCE), SubcategoryController.getSubcategoryById);
router.post('/', canCreate(RESOURCE), SubcategoryController.createSubcategory);
router.put('/:id', canEdit(RESOURCE), SubcategoryController.updateSubcategory);
router.delete('/:id', canDelete(RESOURCE), SubcategoryController.deleteSubcategory);
router.patch('/:id/restore', canEdit(RESOURCE), SubcategoryController.restoreSubcategory);

export default router;
