import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { put, del } from '@vercel/blob';

// Configuração para upload local
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Configuração para Vercel Blob
export class VercelBlobService {

  async uploadFile(
    file: Express.Multer.File,
    folder: string
  ): Promise<string> {
    try {
      const fileName = `${folder}/${uuidv4()}${path.extname(file.originalname)}`;

      const blob = await put(fileName, file.buffer, {
        access: 'public',
        contentType: file.mimetype,
      });

      return blob.url;
    } catch (error) {
      console.error('Error uploading to Vercel Blob:', error);
      throw error;
    }
  }

  async deleteFile(url: string): Promise<void> {
    try {
      await del(url);
    } catch (error) {
      console.error('Error deleting from Vercel Blob:', error);
      throw error;
    }
  }
}

// Factory para escolher o serviço de upload
export class UploadServiceFactory {
  static create() {
    const useVercelBlob = process.env.USE_VERCEL_BLOB === 'true';
    return useVercelBlob ? new VercelBlobService() : null;
  }
}