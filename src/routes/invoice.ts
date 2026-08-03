import { Router } from 'express';
import { InvoiceController } from '../controllers/InvoiceController';
import { canView, canCreate, canEdit } from '../middlewares/permission';

// Faturas fazem parte do item de menu "Lançamentos"
const RESOURCE = 'financial-transactions';

const router = Router();

// GET /financial-invoice?cardId=uuid&month=4&year=2026
router.get('/', canView(RESOURCE), InvoiceController.getInvoice);

// POST /financial-invoice
router.post('/', canCreate(RESOURCE), InvoiceController.createInvoice);

// GET /financial-invoice/card/:cardId - Listar faturas por cartão
router.get('/card/:cardId', canView(RESOURCE), InvoiceController.getInvoicesByCard);

// PUT /financial-invoice/:id/status
router.put('/:id/status', canEdit(RESOURCE), InvoiceController.updateStatus);

// GET /financial-invoice/:id/transactions
router.get('/:id/transactions', canView(RESOURCE), InvoiceController.getInvoiceTransactions);

export default router;
