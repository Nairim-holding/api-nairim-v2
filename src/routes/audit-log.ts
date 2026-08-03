import { Router } from 'express';
import { AuditLogController } from '../controllers/AuditLogController';
import { canView } from '../middlewares/permission';

const RESOURCE = 'audit-logs';

const router = Router();

// Só visualização: log é gerado pelo sistema, não há criar/editar/excluir.
router.get('/', canView(RESOURCE), AuditLogController.getAuditLogs);
router.get('/filters', canView(RESOURCE), AuditLogController.getAuditLogFilters);
router.get('/:id', canView(RESOURCE), AuditLogController.getAuditLogById);

export default router;
