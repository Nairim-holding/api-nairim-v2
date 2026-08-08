import { TransactionController } from '@/controllers/TransactionController';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { upload } from '../utils/upload';
import { DocumentService } from '@/services/DocumentService';
import { Router } from 'express';

const RESOURCE = 'financial-transactions';

const router = Router();

// Rotas básicas de transações
router.get('/', canView(RESOURCE), TransactionController.getTransactions);
router.get('/filters', canView(RESOURCE), TransactionController.getFilters);
router.get('/monthly-summary', canView(RESOURCE), TransactionController.getMonthlySummary);
router.get('/monthly-summary-multi', canView(RESOURCE), TransactionController.getMonthlySummaryMulti);
router.get('/available-years', canView(RESOURCE), TransactionController.getAvailableYears);
router.get('/expense-by-category', canView(RESOURCE), TransactionController.getExpenseByCategory);
router.get('/subcategory-breakdown', canView(RESOURCE), TransactionController.getSubcategoryBreakdown);

// Anexos do lançamento (Tarefa 2 do guia de correções, até 5 arquivos)
router.get('/:id/documents', canView(RESOURCE), TransactionController.getTransactionDocuments);
router.post(
  '/:id/documents',
  canEdit(RESOURCE),
  upload.array('attachments', DocumentService.MAX_TRANSACTION_ATTACHMENTS),
  TransactionController.uploadTransactionDocuments
);
router.delete('/:id/documents/:documentId', canEdit(RESOURCE), TransactionController.deleteTransactionDocument);

// Rota para transferência entre contas (cria o par origem + espelho)
router.post('/transfer', canCreate(RESOURCE), TransactionController.createTransfer);

// Rotas para lançamentos parcelados
router.post('/installments', canCreate(RESOURCE), TransactionController.createInstallments);

// Rotas para lançamentos recorrentes
router.post('/recurring', canCreate(RESOURCE), TransactionController.createRecurring);
router.post('/recurring/generate-next', canCreate(RESOURCE), TransactionController.generateNextRecurring);

// Recorrência infinita (modelo único config-based): cria config + gera 5 anos
router.post('/recurrence', canCreate(RESOURCE), TransactionController.createRecurrence);
// Serviço de manutenção: estende as recorrências ativas (acionável por cron)
router.post('/recurrence/maintain', canEdit(RESOURCE), TransactionController.maintainRecurrences);

// Rotas para gerenciamento de grupos
router.get('/:id/related', canView(RESOURCE), TransactionController.getRelatedTransactions);
router.delete('/group/:group_id', canDelete(RESOURCE), TransactionController.deleteTransactionGroup);

// Rotas de CRUD básico (devem ficar por último para não conflitar com as rotas acima)
router.get('/:id', canView(RESOURCE), TransactionController.getTransactionById);
router.post('/', canCreate(RESOURCE), TransactionController.createTransaction);
router.put('/:id', canEdit(RESOURCE), TransactionController.updateTransaction);
router.delete('/:id', canDelete(RESOURCE), TransactionController.deleteTransaction);
router.patch('/:id/restore', canEdit(RESOURCE), TransactionController.restoreTransaction);

export default router;
