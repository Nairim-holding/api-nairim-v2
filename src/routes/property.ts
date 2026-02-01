import { PropertyController } from '../controllers/PropertyController';
import { 
  validateCreateProperty, 
  validateUpdateProperty, 
  validateGetProperties 
} from '../middlewares/validation';
import { processMultipart, upload } from '../utils/upload';
import { Router } from 'express';

const router = Router();

router.post(
  '/create-unified',
  processMultipart([
    { name: 'propertyData' },
    { name: 'addressData' },
    { name: 'valuesData' },
    { name: 'userId' },
    { name: 'arquivosImagens', maxCount: 20 },
    { name: 'arquivosMatricula', maxCount: 1 },
    { name: 'arquivosRegistro', maxCount: 1 },
    { name: 'arquivosEscritura', maxCount: 1 },
    { name: 'arquivosOutros', maxCount: 10 }
  ]),
  PropertyController.createUnifiedProperty
);

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

router.put(
  '/update-unified/:id',
  processMultipart([
    { name: 'propertyData' },
    { name: 'addressData' },
    { name: 'valuesData' },
    { name: 'userId' },
    { name: 'removedDocuments' },
    { name: 'arquivosImagens', maxCount: 20 },
    { name: 'arquivosMatricula', maxCount: 2 },
    { name: 'arquivosRegistro', maxCount: 2 },
    { name: 'arquivosEscritura', maxCount: 2 },
    { name: 'arquivosOutros', maxCount: 10 }
  ]),
  PropertyController.updateUnifiedProperty
);

export default router;