import { CardController } from '@/controllers/CardController';
import { Router } from 'express';

const router = Router();

router.get('/', CardController.getCards);
router.get('/filters', CardController.getFilters);
router.get('/:id', CardController.getCardById);
router.post('/', CardController.createCard);
router.put('/:id', CardController.updateCard);
router.delete('/:id', CardController.deleteCard);
router.patch('/:id/restore', CardController.restoreCard);

export default router;