import { CardController } from '@/controllers/CardController';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'financial-cards';

const router = Router();

router.get('/', canView(RESOURCE), CardController.getCards);
router.get('/filters', canView(RESOURCE), CardController.getFilters);
router.get('/usage', canView(RESOURCE), CardController.getUsageSummary);
router.post('/quick-create', canCreate(RESOURCE), CardController.quickCreate);
router.get('/:id', canView(RESOURCE), CardController.getCardById);
router.post('/', canCreate(RESOURCE), CardController.createCard);
router.put('/:id', canEdit(RESOURCE), CardController.updateCard);
router.delete('/:id', canDelete(RESOURCE), CardController.deleteCard);
router.patch('/:id/restore', canEdit(RESOURCE), CardController.restoreCard);

export default router;
