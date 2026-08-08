import { Router } from 'express';
import { AuditController } from '../controllers/AuditController';
import { canView, canEdit } from '../middlewares/permission';

const RESOURCE = 'financial-audit';

const router = Router();

router.get('/iptu/settings', canView(RESOURCE), AuditController.getIptuSettings);
router.put('/iptu/settings', canEdit(RESOURCE), AuditController.saveIptuSettings);
router.get('/iptu', canView(RESOURCE), AuditController.getIptuAudit);

export default router;
