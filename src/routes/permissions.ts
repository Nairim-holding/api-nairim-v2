import { Router } from 'express';
import { PermissionsController } from '../controllers/PermissionsController';

const router = Router();

router.get('/me', PermissionsController.getMyPermissions);

export default router;
