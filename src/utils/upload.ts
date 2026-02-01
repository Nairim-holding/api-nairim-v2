import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configuração para processar campos de texto E arquivos
const storage = multer.memoryStorage();

// Middleware principal do Multer
const multerUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Middleware personalizado para processar multipart completo
export const processMultipart = (fields: multer.Field[]) => {
  return multerUpload.fields(fields);
};

// Exporta o multer básico para uso em outros lugares
export const upload = multerUpload;