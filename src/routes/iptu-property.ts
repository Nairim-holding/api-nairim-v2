import { IptuPropertyController } from '../controllers/IptuPropertyController';
import { Router } from 'express';

const router = Router();

router.get('/filters', IptuPropertyController.getIptuPropertyFilters);

export default router;
