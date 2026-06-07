import fs from 'fs/promises';
import path from 'path';
import { ImageConverter } from '../utils/imageConverter';
import { MinioService } from './minioService';

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
  contentDisposition: string;
}

export interface MoveResult {
  result: UploadResult;
  absolutePath: string;
  isImage: boolean;
}

export class BlobService {
  /**
   * Envia o arquivo (que o busboy/multer já gravou em uploads/temp) para o
   * bucket do MinIO (CDN) e retorna a URL pública final.
   *
   * Arquivos que não são imagem têm o temp removido na hora — não há mais
   * conversão a ser feita. Imagens mantêm o temp até a conversão AVIF em
   * background terminar (scheduleAvifConversion cuida da limpeza).
   */
  static async moveFile(
    file: Express.Multer.File,
    filename: string,
    folder: string = 'properties',
  ): Promise<MoveResult> {
    const isImage = ImageConverter.isSupportedImageFormat(file.mimetype);

    const { url, key, contentType } = await MinioService.uploadFile(file, folder);

    if (!isImage && file.path) {
      await fs.unlink(file.path).catch(() => {});
    }

    return {
      result: {
        url,
        pathname: key,
        contentType,
        contentDisposition: `inline; filename="${filename}"`,
      },
      absolutePath: file.path ?? '',
      isImage,
    };
  }

  /**
   * Agenda a conversão AVIF em background (setImmediate).
   * A resposta HTTP já foi enviada antes deste código executar.
   *
   * Lê o temp local, converte, sobe a versão AVIF para o MinIO, remove o
   * objeto original do bucket e o temp local, e avisa o chamador da nova URL.
   */
  static scheduleAvifConversion(
    sourcePath: string,
    originalUrl: string,
    onComplete: (avifUrl: string) => Promise<void>,
  ): void {
    setImmediate(async () => {
      try {
        const buffer = await fs.readFile(sourcePath);
        const avifBuffer = await ImageConverter.convertToAVIF(buffer, 80);

        const avifUrl = originalUrl.replace(/\.[^/.]+$/, '') + '.avif';
        const originalKey = MinioService.keyFromUrl(originalUrl);
        const avifKey = originalKey ? originalKey.replace(/\.[^/.]+$/, '') + '.avif' : null;

        if (!avifKey) {
          throw new Error('Não foi possível derivar a key do MinIO a partir da URL original');
        }

        await MinioService.uploadBuffer(avifBuffer, avifKey, 'image/avif');
        await MinioService.deleteFile(originalUrl);
        await fs.unlink(sourcePath).catch(() => {});

        await onComplete(avifUrl);
        console.log(`✅ AVIF pronto: ${avifKey}`);
      } catch (err: any) {
        console.error(`⚠️  Conversão AVIF falhou para ${path.basename(sourcePath)}: ${err.message}`);
        // Arquivo original mantido intacto no bucket em caso de erro
      }
    });
  }

  // Mantém compatibilidade com código que chama uploadFile diretamente
  static async uploadFile(
    file: Express.Multer.File,
    filename: string,
    folder: string = 'properties',
  ): Promise<UploadResult> {
    const { result } = await this.moveFile(file, filename, folder);
    return result;
  }

  static async uploadMultipleFilesWithLimit(
    files: Express.Multer.File[],
    folder: string = 'properties',
    maxConcurrent: number = 3,
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
          }
        }
      }
    };

    const workers = Array(maxConcurrent).fill(null).map(() => worker());
    await Promise.all(workers);
    return results;
  }

  /** Remove arquivos temp com mais de 1 hora (órfãos de requests com erro) */
  static async cleanupTempFiles(): Promise<void> {
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    const oneHourMs = 60 * 60 * 1000;
    try {
      const files = await fs.readdir(tempDir);
      await Promise.all(
        files.map(async (name) => {
          const filePath = path.join(tempDir, name);
          const stat = await fs.stat(filePath).catch(() => null);
          if (stat && Date.now() - stat.mtimeMs > oneHourMs) {
            await fs.unlink(filePath).catch(() => {});
          }
        }),
      );
    } catch {}
  }
}
