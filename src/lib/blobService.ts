import fs from 'fs/promises';
import path from 'path';
import { ImageConverter } from '../utils/imageConverter';

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
      let fileBuffer = file.buffer;
      let safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();

      // Converter imagens para AVIF automaticamente
      if (ImageConverter.isSupportedImageFormat(file.mimetype)) {
        try {
          console.log(`🎨 Processando imagem: ${filename} (${file.mimetype})`);

          const imageInfo = await ImageConverter.getImageInfo(file.buffer);
          console.log(`📊 Dimensões originais: ${imageInfo.width}x${imageInfo.height}px`);

          fileBuffer = await ImageConverter.convertToAVIF(file.buffer, 80);
          safeFilename = safeFilename.replace(/\.[^/.]+$/, '') + '.avif';

          console.log(`✅ Imagem convertida com sucesso para AVIF`);
        } catch (error: any) {
          console.warn(`⚠️ Falha ao converter para AVIF, salvando no formato original: ${error.message}`);
        }
      }

      const uniqueFilename = `${Date.now()}-${safeFilename}`;

      // Define os caminhos
      const relativePath = path.posix.join(folder, uniqueFilename);
      const absolutePath = path.join(process.cwd(), 'uploads', relativePath);

      // Garante que a pasta exista (cria se não existir)
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });

      // Salva o arquivo (convertido ou original)
      await fs.writeFile(absolutePath, fileBuffer);

      // Pega a BASE_URL do .env (ex: http://187.77.236.241:5000)
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

      return {
        url: `${baseUrl}/uploads/${relativePath}`,
        pathname: relativePath,
        contentType: file.mimetype,
        contentDisposition: `inline; filename="${safeFilename}"`,
      };
    } catch (error: any) {
      console.error('❌ Erro ao salvar arquivo localmente:', error);
      throw new Error(`Falha no upload do arquivo: ${error.message}`);
    }
  }

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
          }
        }
      }
    };
    
    const workers = Array(maxConcurrent).fill(null).map(() => worker());
    await Promise.all(workers);
    
    return results;
  }
}