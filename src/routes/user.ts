import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { 
  validateCreateUser, 
  validateUpdateUser, 
  validateGetUsers 
} from '../middlewares/validation';

const router = Router();

// Rotas de usuários
router.get('/', validateGetUsers, UserController.getUsers);
router.get('/filters', UserController.getUserFilters);
router.get('/:id', UserController.getUserById);
router.post('/', validateCreateUser, UserController.createUser);
router.put('/:id', validateUpdateUser, UserController.updateUser);
router.delete('/:id', UserController.deleteUser);
router.patch('/:id/restore', UserController.restoreUser);
router.patch('/:id/change-password', UserController.changePassword);

export default router;