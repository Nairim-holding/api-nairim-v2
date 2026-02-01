import { put } from '@vercel/blob';
import { env } from '@/env';

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
  contentDisposition: string;
}

export class BlobService {
  static async uploadFile(
    file: Express.Multer.File,
    filename: string,
    folder: string = 'properties'
  ): Promise<UploadResult> {
    try {
      if (!env.BLOB_READ_WRITE_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN não configurado');
      }

      // Usar nome de arquivo seguro
      const safeFilename = filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .toLowerCase();
      
      const pathname = `${folder}/${Date.now()}-${safeFilename}`;
      
      // Timeout para o fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

      try {
        const blob = await put(pathname, file.buffer, {
          access: 'public',
          token: env.BLOB_READ_WRITE_TOKEN,
          contentType: file.mimetype,
        });

        clearTimeout(timeoutId);

        return {
          url: blob.url,
          pathname: blob.pathname,
          contentType: file.mimetype,
          contentDisposition: `inline; filename="${safeFilename}"`,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Timeout ao fazer upload para o Vercel Blob');
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload para Vercel Blob:', error);
      throw new Error(`Falha no upload do arquivo: ${error.message}`);
    }
  }

  // Método para upload em paralelo com limite de concorrência
  static async uploadMultipleFilesWithLimit(
    files: Express.Multer.File[],
    folder: string = 'properties',
    maxConcurrent: number = 3
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    const queue = [...files];
    
    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const file = queue.shift();
        if (file) {
          try {
            const result = await this.uploadFile(file, file.originalname, folder);
            results.push(result);
          } catch (error) {
            console.error(`❌ Erro no upload de ${file.originalname}:`, error);
            // Continue apesar do erro
          }
        }
      }
    };
    
    // Criar workers concorrentes
    const workers = Array(maxConcurrent).fill(null).map(() => worker());
    await Promise.all(workers);
    
    return results;
  }
}