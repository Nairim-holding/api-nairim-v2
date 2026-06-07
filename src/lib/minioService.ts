import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
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

const PUBLIC_PREFIX = () => `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/`;

export interface MinioUploadResult {
  url: string;
  key: string;
  contentType: string;
}

export class MinioService {
  /** Monta a URL pública final a partir da key do objeto no bucket. */
  static urlFromKey(key: string): string {
    return `${PUBLIC_PREFIX()}${key}`;
  }

  /** Extrai a key do objeto a partir da URL pública salva no banco (ou null se não pertencer ao bucket). */
  static keyFromUrl(url: string): string | null {
    const prefix = PUBLIC_PREFIX();
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  /** Envia um buffer para o bucket sob a key informada e retorna a URL pública final. */
  static async uploadBuffer(buffer: Buffer, key: string, contentType: string, originalFilename?: string): Promise<string> {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ContentDisposition: originalFilename ? `inline; filename="${originalFilename}"` : 'inline',
      }),
    );
    return this.urlFromKey(key);
  }

  /**
   * Envia o arquivo para o bucket do MinIO e retorna a URL pública final
   * (montada a partir de MINIO_PUBLIC_URL, o domínio exposto via Traefik)
   * para ser salva no banco de dados.
   *
   * Usa @aws-sdk/lib-storage (Upload) com leitura via stream direto do disco:
   * em vez de carregar o arquivo inteiro em memória (fs.readFile) e mandar num
   * único PUT, faz upload multipart com partes enviadas em paralelo. Isso é
   * crítico para vídeos grandes (centenas de MB) — evita picos de memória e
   * acelera o envio através do paralelismo das partes.
   */
  static async uploadFile(
    file: Express.Multer.File,
    folder: string = 'properties',
  ): Promise<MinioUploadResult> {
    const safeFilename = file.originalname.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    const key = path.posix.join(folder, `${Date.now()}-${safeFilename}`);

    const body = file.buffer ?? (file.path ? fs.createReadStream(file.path) : null);
    if (!body) {
      throw new Error('Nenhum dado de arquivo disponível (nem buffer nem path)');
    }

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: env.MINIO_BUCKET,
        Key: key,
        Body: body,
        ContentType: file.mimetype,
        ContentDisposition: `inline; filename="${file.originalname}"`,
      },
      queueSize: 4,
      partSize: 10 * 1024 * 1024,
    });

    await upload.done();

    return { url: this.urlFromKey(key), key, contentType: file.mimetype };
  }

  /** Remove um arquivo do bucket a partir da URL pública salva no banco. */
  static async deleteFile(url: string): Promise<void> {
    const key = this.keyFromUrl(url);
    if (!key) return;

    await s3Client
      .send(new DeleteObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }))
      .catch(() => {});
  }
}
