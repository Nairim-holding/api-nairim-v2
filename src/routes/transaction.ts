import { TransactionController } from '@/controllers/TransactionController';
import { Router } from 'express';

const router = Router();

router.get('/', TransactionController.getTransactions);
router.get('/filters', TransactionController.getFilters); 
router.get('/:id', TransactionController.getTransactionById);
router.post('/', TransactionController.createTransaction);
router.put('/:id', TransactionController.updateTransaction);
router.delete('/:id', TransactionController.deleteTransaction);
router.patch('/:id/restore', TransactionController.restoreTransaction);

export default router;