import { TransactionController } from '@/controllers/TransactionController';
import { Router } from 'express';

const router = Router();

// Rotas básicas de transações
router.get('/', TransactionController.getTransactions);
router.get('/filters', TransactionController.getFilters);
router.get('/monthly-summary', TransactionController.getMonthlySummary);
router.get('/available-years', TransactionController.getAvailableYears);
router.get('/expense-by-category', TransactionController.getExpenseByCategory);
router.get('/subcategory-breakdown', TransactionController.getSubcategoryBreakdown);

// Rota para transferência entre contas (cria o par origem + espelho)
router.post('/transfer', TransactionController.createTransfer);

// Rotas para lançamentos parcelados
router.post('/installments', TransactionController.createInstallments);

// Rotas para lançamentos recorrentes
router.post('/recurring', TransactionController.createRecurring);
router.post('/recurring/generate-next', TransactionController.generateNextRecurring);

// Rotas para gerenciamento de grupos
router.get('/:id/related', TransactionController.getRelatedTransactions);
router.delete('/group/:group_id', TransactionController.deleteTransactionGroup);

// Rotas de CRUD básico (devem ficar por último para não conflitar com as rotas acima)
router.get('/:id', TransactionController.getTransactionById);
router.post('/', TransactionController.createTransaction);
router.put('/:id', TransactionController.updateTransaction);
router.delete('/:id', TransactionController.deleteTransaction);
router.patch('/:id/restore', TransactionController.restoreTransaction);

export default router;