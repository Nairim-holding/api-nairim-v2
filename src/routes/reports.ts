import { ReportController } from '@/controllers/ReportController';
import { canView } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'financial-reports';

const router = Router();

router.get('/grouped', canView(RESOURCE), ReportController.getGrouped);
router.get('/extrato', canView(RESOURCE), ReportController.getExtrato);
router.get('/income-expense', canView(RESOURCE), ReportController.getIncomeExpense);
router.get('/demonstrativo', canView(RESOURCE), ReportController.getDemonstrativo);

export default router;
