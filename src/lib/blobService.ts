import fs from 'fs/promises';
import path from 'path';
import { ImageConverter } from '../utils/imageConverter';

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

const getBaseUrl = () => process.env.BASE_URL || 'http://localhost:5000';

export class BlobService {
  /**
   * Move o arquivo do diretório temp para o destino final.
   *
   * Com diskStorage o arquivo já está em disco quando o handler roda —
   * fs.rename() é uma operação atômica do SO (microssegundos).
   * Fallback para fs.writeFile quando vem de memoryStorage.
   */
  static async moveFile(
    file: Express.Multer.File,
    filename: string,
    folder: string = 'properties',
  ): Promise<MoveResult> {
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    const uniqueFilename = `${Date.now()}-${safeFilename}`;
    const relativePath = path.posix.join(folder, uniqueFilename);
    const absolutePath = path.join(process.cwd(), 'uploads', relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    if (file.path) {
      // diskStorage: rename atômico (mesmo filesystem)
      try {
        await fs.rename(file.path, absolutePath);
      } catch (err: any) {
        if (err.code === 'EXDEV') {
          // Filesystems diferentes: copia e apaga
          await fs.copyFile(file.path, absolutePath);
          await fs.unlink(file.path).catch(() => {});
        } else {
          throw err;
        }
      }
    } else if (file.buffer) {
      // memoryStorage: fallback (não recomendado para arquivos grandes)
      await fs.writeFile(absolutePath, file.buffer);
    } else {
      throw new Error('Nenhum dado de arquivo disponível (nem path nem buffer)');
    }

    const isImage = ImageConverter.isSupportedImageFormat(file.mimetype);

    return {
      result: {
        url: `${getBaseUrl()}/uploads/${relativePath}`,
        pathname: relativePath,
        contentType: file.mimetype,
        contentDisposition: `inline; filename="${safeFilename}"`,
      },
      absolutePath,
      isImage,
    };
  }

  /**
   * Agenda a conversão AVIF em background (setImmediate).
   * A resposta HTTP já foi enviada antes deste código executar.
   * onComplete recebe a nova URL AVIF para atualizar o banco.
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

        const avifPath = sourcePath.replace(/\.[^/.]+$/, '') + '.avif';
        const avifUrl = originalUrl.replace(/\.[^/.]+$/, '') + '.avif';

        await fs.writeFile(avifPath, avifBuffer);
        // Apaga original somente após AVIF escrito com sucesso
        await fs.unlink(sourcePath).catch(() => {});

        await onComplete(avifUrl);
        console.log(`✅ AVIF pronto: ${path.basename(avifPath)}`);
      } catch (err: any) {
        console.error(
          `⚠️  Conversão AVIF falhou para ${path.basename(sourcePath)}: ${err.message}`,
        );
        // Arquivo original mantido intacto em caso de erro
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
