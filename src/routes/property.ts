import { PropertyController } from '../controllers/PropertyController';
import { 
  validateCreateProperty, 
  validateUpdateProperty, 
  validateGetProperties 
} from '../middlewares/validation';
import { upload } from '../utils/upload';
import { Router } from 'express';

const router = Router();

router.get('/', validateGetProperties, PropertyController.getProperties);
router.get('/filters', PropertyController.getPropertyFilters);
router.get('/:id', PropertyController.getPropertyById);
router.post('/', validateCreateProperty, PropertyController.createProperty);
router.put('/:id', validateUpdateProperty, PropertyController.updateProperty);
router.delete('/:id', PropertyController.deleteProperty);
router.patch('/:id/restore', PropertyController.restoreProperty);

// Upload de documentos
router.post(
  '/:id/documents',
  upload.fields([
    { name: 'arquivosImagens' },
    { name: 'arquivosMatricula' },
    { name: 'arquivosRegistro' },
    { name: 'arquivosEscritura' }
  ]),
  PropertyController.uploadDocuments
);

router.put(
  '/:id/documents',
  upload.fields([
    { name: 'arquivosImagens' },
    { name: 'arquivosMatricula' },
    { name: 'arquivosRegistro' },
    { name: 'arquivosEscritura' }
  ]),
  PropertyController.updateDocuments
);

export default router;