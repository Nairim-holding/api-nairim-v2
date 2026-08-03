import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import {
  validateCreateUser,
  validateUpdateUser,
  validateGetUsers
} from '../middlewares/validation';
import { canView, canCreate, canEdit, canDelete } from '../middlewares/permission';
import { upload } from '../utils/upload';

const RESOURCE = 'users';

const router = Router();

// Rotas de usuários
router.get('/', canView(RESOURCE), validateGetUsers, UserController.getUsers);
router.get('/filters', canView(RESOURCE), UserController.getUserFilters);
router.get('/:id', canView(RESOURCE), UserController.getUserById);
router.post('/', canCreate(RESOURCE), validateCreateUser, UserController.createUser);
router.put('/:id', canEdit(RESOURCE), validateUpdateUser, UserController.updateUser);
router.delete('/:id', canDelete(RESOURCE), UserController.deleteUser);
router.patch('/:id/restore', canEdit(RESOURCE), UserController.restoreUser);
router.patch('/:id/change-password', canEdit(RESOURCE), UserController.changePassword);

// Situação (botão liga/desliga da listagem) e foto
router.patch('/:id/active', canEdit(RESOURCE), UserController.setActive);
router.post('/:id/photo', canEdit(RESOURCE), upload.single('file'), UserController.uploadPhoto);

// Agenda de acesso (Controle de horário / jornada)
router.get('/:id/schedule', canView(RESOURCE), UserController.getSchedule);
router.put('/:id/schedule', canEdit(RESOURCE), UserController.setSchedule);

export default router;
