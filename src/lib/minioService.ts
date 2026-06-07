import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '@/env';

/**
 * Client S3 apontando exclusivamente para o nosso MinIO self-hosted.
 * forcePathStyle é obrigatório: o MinIO resolve buckets via path
 * (http://endpoint/bucket/key), não via subdomínio como a AWS faz.
 */
const s3Client = new S3Client({
  endpoint: env.MINIO_ENDPOINT,
  region: env.MINIO_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
});

export interface MinioUploadResult {
  url: string;
  key: string;
  contentType: string;
}

export class MinioService {
  /**
   * Envia o arquivo para o bucket do MinIO e retorna a URL pública final
   * (montada a partir de MINIO_PUBLIC_URL, o domínio exposto via Traefik)
   * para ser salva no banco de dados.
   */
  static async uploadFile(
    file: Express.Multer.File,
    folder: string = 'properties',
  ): Promise<MinioUploadResult> {
    const safeFilename = file.originalname.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    const key = path.posix.join(folder, `${Date.now()}-${safeFilename}`);

    let body: Buffer;
    if (file.buffer) {
      body = file.buffer;
    } else if (file.path) {
      body = await fs.readFile(file.path);
    } else {
      throw new Error('Nenhum dado de arquivo disponível (nem buffer nem path)');
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: key,
        Body: body,
        ContentType: file.mimetype,
        ContentDisposition: `inline; filename="${file.originalname}"`,
      }),
    );

    return {
      url: `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/${key}`,
      key,
      contentType: file.mimetype,
    };
  }

  /** Remove um arquivo do bucket a partir da URL pública salva no banco. */
  static async deleteFile(url: string): Promise<void> {
    const prefix = `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/`;
    if (!url.startsWith(prefix)) return;

    const key = url.slice(prefix.length);

    await s3Client
      .send(new DeleteObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }))
      .catch(() => {});
  }
}
