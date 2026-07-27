import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// Garante que o diretório temp existe na inicialização
const tempDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// diskStorage: arquivos são gravados em disco enquanto o cliente envia (streaming).
// Quando o handler roda, o arquivo já está salvo — sem bloqueio de I/O na resposta.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tempDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const multerUpload = multer({ storage });

export const fixMulterEncoding = (req: Request, _res: Response, next: NextFunction) => {
  if (req.file) {
    req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  }
  if (req.files) {
    if (Array.isArray(req.files)) {
      req.files.forEach(f => {
        f.originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
      });
    } else {
      Object.values(req.files).forEach(filesArray => {
        filesArray.forEach(f => {
          f.originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
        });
      });
    }
  }
  next();
};

export const processMultipart = (fields: multer.Field[]) => [
  multerUpload.fields(fields),
  fixMulterEncoding,
];

export const upload = {
  single: (field: string) => [multerUpload.single(field), fixMulterEncoding],
  array: (field: string, maxCount?: number) => [multerUpload.array(field, maxCount), fixMulterEncoding],
  fields: (fields: multer.Field[]) => [multerUpload.fields(fields), fixMulterEncoding],
  any: () => [multerUpload.any(), fixMulterEncoding],
} as any;
