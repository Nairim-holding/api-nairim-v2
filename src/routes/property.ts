import { PropertyController } from '../controllers/PropertyController';
import { 
  validateCreateProperty, 
  validateUpdateProperty, 
  validateGetProperties 
} from '../middlewares/validation';
import { upload } from '../utils/upload';
import { Router } from 'express';

const router = Router();

router.post('/create-unified', PropertyController.createUnifiedProperty);

router.get('/', validateGetProperties, PropertyController.getProperties);
router.get('/filters', PropertyController.getPropertyFilters);
router.get('/:id', PropertyController.getPropertyById);
router.post('/', validateCreateProperty, PropertyController.createProperty);
router.put('/:id', validateUpdateProperty, PropertyController.updateProperty);
router.delete('/:id', PropertyController.deleteProperty);
router.patch('/:id/restore', PropertyController.restoreProperty);

router.post(
  '/:id/documents',
  upload.fields([
    { name: 'arquivosImagens' },
    { name: 'arquivosMatricula' },
    { name: 'arquivosRegistro' },
    { name: 'arquivosEscritura' },
    { name: 'arquivosOutros' }
  ]),
  PropertyController.uploadDocuments
);

router.put(
  '/:id/documents',
  upload.fields([
    { name: 'arquivosImagens' },
    { name: 'arquivosMatricula' },
    { name: 'arquivosRegistro' },
    { name: 'arquivosEscritura' },
    { name: 'arquivosOutros' }
  ]),
  PropertyController.updateDocuments
);

router.put('/update-unified/:id', PropertyController.updateUnifiedProperty);

export default router;