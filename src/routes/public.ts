import { Router } from 'express';
import { PublicController } from '../controllers/PublicController';

const router = Router({ mergeParams: true });

// Imóveis
router.get('/properties/available', PublicController.getAvailableProperties);
router.get('/properties/:id', PublicController.getPropertyById);
router.get('/properties', PublicController.getProperties);

// Listas de apoio (filtros / vitrine)
router.get('/owners', PublicController.getOwners);
router.get('/property-types', PublicController.getPropertyTypes);
router.get('/agencies', PublicController.getAgencies);

export default router;
