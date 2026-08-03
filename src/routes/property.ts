import { PropertyController } from '../controllers/PropertyController';
import {
  validateCreateProperty,
  validateUpdateProperty,
  validateGetProperties
} from '../middlewares/validation';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { upload } from '../utils/upload';
import { Router } from 'express';

const RESOURCE = 'properties';

const router = Router();

router.post('/create-unified', canCreate(RESOURCE), PropertyController.createUnifiedProperty);

router.get('/', canView(RESOURCE), validateGetProperties, PropertyController.getProperties);
router.get('/filters', canView(RESOURCE), PropertyController.getPropertyFilters);
router.get('/:id', canView(RESOURCE), PropertyController.getPropertyById);
router.post('/', canCreate(RESOURCE), validateCreateProperty, PropertyController.createProperty);
router.put('/:id', canEdit(RESOURCE), validateUpdateProperty, PropertyController.updateProperty);
router.delete('/:id', canDelete(RESOURCE), PropertyController.deleteProperty);
router.patch('/:id/restore', canEdit(RESOURCE), PropertyController.restoreProperty);

// Anexar/atualizar documentos altera um imóvel existente → permissão de edição
router.post(
  '/:id/documents',
  canEdit(RESOURCE),
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
  canEdit(RESOURCE),
  upload.fields([
    { name: 'arquivosImagens' },
    { name: 'arquivosMatricula' },
    { name: 'arquivosRegistro' },
    { name: 'arquivosEscritura' },
    { name: 'arquivosOutros' }
  ]),
  PropertyController.updateDocuments
);

router.put('/update-unified/:id', canEdit(RESOURCE), PropertyController.updateUnifiedProperty);

export default router;
