import { BlobService } from '../lib/blobService';
import { ImageConverter } from './imageConverter';

export class LocalUploadService {
  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    try {
      // Usa BlobService.moveFile que suporta tanto diskStorage quanto memoryStorage
      const { result, absolutePath, isImage } = await BlobService.moveFile(
        file,
        file.originalname,
        folder,
      );

      if (isImage) {
        // Conversão AVIF em background — não bloqueia a resposta
        BlobService.scheduleAvifConversion(
          absolutePath,
          result.url,
          async () => {
            // Sem ID de documento aqui — atualização via PropertyService
          },
        );
      }

      return result.url;
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      throw error;
    }
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const filePath = url.replace(`${baseUrl}/uploads/`, '');
      const absolutePath = require('path').join(process.cwd(), 'uploads', filePath);
      await require('fs/promises').unlink(absolutePath).catch(() => {});
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
}

export class UploadServiceFactory {
  static create() {
    return new LocalUploadService();
  }
}
