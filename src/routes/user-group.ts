import { UserGroupController } from '../controllers/UserGroupController';
import {
  validateCreateUserGroup,
  validateUpdateUserGroup,
  validateGetUserGroups
} from '../middlewares/validation';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { Router } from 'express';

const RESOURCE = 'user-groups';

const router = Router();

// Catálogo de recursos para montar a matriz de diretivas. Só depende de poder
// visualizar grupos — é metadado, não dado de nenhuma empresa.
router.get('/resources', canView(RESOURCE), UserGroupController.getResourceCatalog);

router.get('/', canView(RESOURCE), validateGetUserGroups, UserGroupController.getUserGroups);
router.get('/filters', canView(RESOURCE), UserGroupController.getUserGroupFilters);
router.get('/:id', canView(RESOURCE), UserGroupController.getUserGroupById);
router.post('/', canCreate(RESOURCE), validateCreateUserGroup, UserGroupController.createUserGroup);
router.put('/:id', canEdit(RESOURCE), validateUpdateUserGroup, UserGroupController.updateUserGroup);
router.delete('/:id', canDelete(RESOURCE), UserGroupController.deleteUserGroup);
router.patch('/:id/restore', canEdit(RESOURCE), UserGroupController.restoreUserGroup);

// Clonar: cria um grupo novo com as diretivas da origem → permissão de criação
router.post('/:id/clone', canCreate(RESOURCE), UserGroupController.cloneUserGroup);

// Diretivas de acesso do grupo
router.get('/:id/permissions', canView(RESOURCE), UserGroupController.getPermissions);
router.put('/:id/permissions', canEdit(RESOURCE), UserGroupController.updatePermissions);

export default router;
