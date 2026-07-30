import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

export interface MinioObjectInfo {
  key: string;
  size: number;
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

  static async uploadBuffer(buffer: Buffer, key: string, contentType: string, originalFilename?: string): Promise<string> {
    const contentDisposition = originalFilename
      ? `inline; filename="${originalFilename.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`
      : 'inline';

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ContentDisposition: contentDisposition,
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
        ContentDisposition: `inline; filename="${file.originalname.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}"; filename*=UTF-8''${encodeURIComponent(file.originalname)}`,
      },
      queueSize: 4,
      partSize: 10 * 1024 * 1024,
    });

    await upload.done();

    return { url: this.urlFromKey(key), key, contentType: file.mimetype };
  }

  /**
   * Lista todos os objetos do bucket (ou de um prefixo), com o tamanho de cada um.
   *
   * O ListObjectsV2 já devolve `Size` em bytes junto com a key, então o custo é de
   * uma chamada por página de 1000 objetos — não é preciso um HEAD por arquivo.
   * Usado apenas para leitura/estatística (StorageUsageService); não participa do
   * fluxo de upload.
   */
  static async listAllObjects(prefix?: string): Promise<MinioObjectInfo[]> {
    const objects: MinioObjectInfo[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: env.MINIO_BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of page.Contents ?? []) {
        if (!item.Key) continue;
        objects.push({ key: item.Key, size: item.Size ?? 0 });
      }

      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);

    return objects;
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
