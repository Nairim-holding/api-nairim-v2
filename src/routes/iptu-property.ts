import { IptuPropertyController } from '../controllers/IptuPropertyController';
import { canView } from '../middlewares/permission';
import { Router } from 'express';

// IPTU é parte do item de menu "Imóvel"
const RESOURCE = 'properties';

const router = Router();

router.get('/filters', canView(RESOURCE), IptuPropertyController.getIptuPropertyFilters);

export default router;
