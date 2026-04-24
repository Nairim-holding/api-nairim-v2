import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

export const processMultipart = (fields: multer.Field[]) => multerUpload.fields(fields);
export const upload = multerUpload;
