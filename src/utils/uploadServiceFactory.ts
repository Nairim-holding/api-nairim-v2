import fs from 'fs/promises';
import path from 'path';
import { BlobService } from '../lib/blobService';
import { MinioService } from '../lib/minioService';

export class CdnUploadService {
  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    try {
      // BlobService.moveFile envia o arquivo para o bucket do MinIO (CDN)
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
      if (MinioService.keyFromUrl(url)) {
        await MinioService.deleteFile(url);
        return;
      }

      // Compatibilidade com arquivos antigos salvos localmente antes da migração para o MinIO
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const filePath = url.replace(`${baseUrl}/uploads/`, '');
      const absolutePath = path.join(process.cwd(), 'uploads', filePath);
      await fs.unlink(absolutePath).catch(() => {});
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
}

export class UploadServiceFactory {
  static create() {
    return new CdnUploadService();
  }
}
