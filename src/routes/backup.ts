import { Router } from 'express';
import multer from 'multer';
import { BackupController } from '../controllers/BackupController';
import { requireAdmin } from '../middlewares/auth';
import { fixMulterEncoding } from '../utils/upload';

const router = Router();

// Multer para upload de arquivo de backup (JSON, máx 50 MB)
const uploadBackup = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    // Note: here file.originalname is not yet fixed, but typically backup files are .json and won't have issue with extension matching.
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos JSON são permitidos'));
    }
  },
});

// Export: gera backup e envia para download
router.get('/export', requireAdmin, BackupController.exportBackup);

// Restore: recebe arquivo + confirmação, restaura os dados
router.post('/restore', requireAdmin, uploadBackup.single('file'), fixMulterEncoding, BackupController.restoreBackup);

// Backups automáticos (gerados antes de cada restore): listar e baixar
router.get('/auto', requireAdmin, BackupController.listAutoBackups);
router.get('/auto/:filename', requireAdmin, BackupController.downloadAutoBackup);

export default router;
