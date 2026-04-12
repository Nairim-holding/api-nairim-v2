import { Router } from 'express';
import { InvoiceController } from '../controllers/InvoiceController';

const router = Router();

// GET /financial-invoice?cardId=uuid&month=4&year=2026
router.get('/', InvoiceController.getInvoice);

// POST /financial-invoice
router.post('/', InvoiceController.createInvoice);

// GET /financial-invoice/card/:cardId - Listar faturas por cartão
router.get('/card/:cardId', InvoiceController.getInvoicesByCard);

// PUT /financial-invoice/:id/status
router.put('/:id/status', InvoiceController.updateStatus);

// GET /financial-invoice/:id/transactions
router.get('/:id/transactions', InvoiceController.getInvoiceTransactions);

export default router;
