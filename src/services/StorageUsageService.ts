import fs from 'fs/promises';
import path from 'path';
import prisma from '../lib/prisma';
import { MinioService, MinioObjectInfo } from '../lib/minioService';

export interface StorageUsageGroup {
  key: string;
  label: string;
  bytes: number;
  megabytes: number;
  files: number;
}

export interface StorageUsageResult {
  groups: StorageUsageGroup[];
  totalBytes: number;
  totalMegabytes: number;
  totalFiles: number;
}

const BYTES_PER_MB = 1024 * 1024;

const toMegabytes = (bytes: number) => Math.round((bytes / BYTES_PER_MB) * 100) / 100;

/**
 * Grupos fixos, sempre presentes na resposta (mesmo zerados) para o gráfico não "pular".
 *
 * "company" é só os assets de identidade visual (logo, favicon, OG image) — daí o
 * rótulo "Identidade Visual" e não "Empresa": ao lado de Imóveis e Locações, um
 * grupo chamado "Empresa" parece o total da empresa, quando é uma categoria irmã.
 * O total de todos os anexos é o totalMegabytes do resultado.
 */
const GROUP_LABELS: Record<string, string> = {
  properties: 'Imóveis',
  leases: 'Locações',
  company: 'Identidade Visual',
  other: 'Outros',
};

const FIXED_GROUPS = ['properties', 'leases', 'company'] as const;

/**
 * Cache do inventário do bucket. É global (não por empresa) porque a listagem é
 * do bucket inteiro — uma varredura serve todas as empresas dentro da janela do
 * TTL. Sem isso, cada abertura do dashboard pagaria uma varredura completa.
 *
 * O TTL sozinho não basta: um anexo enviado agora só apareceria no gráfico
 * quando a janela expirasse. Por isso o cache também guarda um "carimbo" do
 * estado das mídias (ver getMediaStamp); se ele mudou, a varredura é refeita na
 * hora. O carimbo é uma agregação de poucos milissegundos — bem mais barato que
 * listar o bucket a cada requisição.
 */
const BUCKET_CACHE_TTL_MS = 5 * 60 * 1000;
let bucketCache: { objects: MinioObjectInfo[]; fetchedAt: number; stamp: string } | null = null;
let bucketInFlight: Promise<MinioObjectInfo[]> | null = null;

export function invalidateStorageUsageCache(): void {
  bucketCache = null;
}

/**
 * Assinatura barata do estado dos anexos, global a todas as empresas (o cache
 * também é). Cobre as duas origens de mídia: `Document` (imóveis e locações) e
 * `CompanyBranding` (logo, favicon e demais assets da empresa) — sem a segunda,
 * subir um logo não invalidaria o cache e o grupo "Empresa" ficaria parado.
 *
 * Vai por $queryRaw de propósito: a extensão de tenant do Prisma injeta
 * company_id nas agregações, e aqui o número precisa ser do banco todo.
 */
async function getMediaStamp(): Promise<string> {
  const rows = await prisma.$queryRaw<
    Array<{ docs: bigint; docs_last: Date | null; branding_last: Date | null }>
  >`
    SELECT (SELECT COUNT(*)::bigint    FROM "Document" WHERE deleted_at IS NULL) AS docs,
           (SELECT MAX(updated_at)     FROM "Document" WHERE deleted_at IS NULL) AS docs_last,
           (SELECT MAX(updated_at)     FROM "CompanyBranding")                   AS branding_last
  `;

  const row = rows[0];
  return [
    row?.docs ?? 0,
    row?.docs_last?.getTime() ?? 0,
    row?.branding_last?.getTime() ?? 0,
  ].join(':');
}

async function getBucketObjects(forceRefresh: boolean): Promise<MinioObjectInfo[]> {
  if (forceRefresh) bucketCache = null;

  if (bucketCache && Date.now() - bucketCache.fetchedAt < BUCKET_CACHE_TTL_MS) {
    // Se um anexo entrou ou saiu desde a varredura, o cache está velho mesmo
    // dentro do TTL. Falha na conferência não derruba a resposta: nesse caso
    // vale mais servir o número cacheado do que quebrar o gráfico.
    const stamp = await getMediaStamp().catch(() => bucketCache?.stamp);
    if (stamp === bucketCache.stamp) return bucketCache.objects;
    bucketCache = null;
  }

  // Requisições concorrentes com o cache frio compartilham a mesma varredura.
  if (!bucketInFlight) {
    bucketInFlight = Promise.all([MinioService.listAllObjects(), getMediaStamp()])
      .then(([objects, stamp]) => {
        bucketCache = { objects, fetchedAt: Date.now(), stamp };
        return objects;
      })
      .finally(() => {
        bucketInFlight = null;
      });
  }

  return bucketInFlight;
}

/**
 * Remove a extensão da key.
 *
 * A conversão AVIF em background (BlobService.scheduleAvifConversion) sobe uma
 * versão `.avif` e apaga o objeto original, mas nem todo fluxo atualiza o
 * `file_path` no banco. Casar banco↔bucket pela key sem extensão faz o registro
 * antigo (`.jpg`) encontrar o objeto real (`.avif`).
 */
function stripExtension(key: string): string {
  return key.replace(/\.[^/.]+$/, '');
}

/** Índice keySemExtensão → bytes/qtde. Duas variantes da mesma key (ex.: .jpg órfão
 *  + .avif convertido) somam, porque de fato ocupam espaço as duas. */
function indexBucket(objects: MinioObjectInfo[]) {
  const index = new Map<string, { bytes: number; files: number }>();

  for (const object of objects) {
    const normalized = stripExtension(object.key);
    const entry = index.get(normalized);
    if (entry) {
      entry.bytes += object.size;
      entry.files += 1;
    } else {
      index.set(normalized, { bytes: object.size, files: 1 });
    }
  }

  return index;
}

/** Caminho absoluto em disco para URLs legadas (`BASE_URL/uploads/...`), anteriores ao MinIO. */
function localPathFromUrl(url: string): string | null {
  const marker = '/uploads/';
  const at = url.indexOf(marker);
  if (at === -1) return null;

  const relative = url.slice(at + marker.length);
  if (!relative || relative.includes('..')) return null;

  return path.join(process.cwd(), 'uploads', relative);
}

export class StorageUsageService {
  /**
   * Espaço ocupado pelas mídias/anexos da empresa em contexto, agrupado por local
   * de armazenamento (Imóveis, Locações, Empresa).
   *
   * O tamanho vem do inventário do bucket (o ListObjectsV2 já devolve o Size de
   * cada objeto), não de metadado no banco — `Document` não guarda tamanho. O
   * banco entra só para dizer de quem é cada arquivo: as keys da empresa saem de
   * `Document` (filtrado por company_id pela extensão do Prisma) e de
   * `CompanyBranding`.
   */
  static async getStorageUsage(companyId: string, forceRefresh = false): Promise<StorageUsageResult> {
    const [documents, branding, objects] = await Promise.all([
      prisma.document.findMany({
        where: { deleted_at: null },
        select: { file_path: true, property_id: true, lease_id: true },
      }),
      prisma.companyBranding.findUnique({
        where: { company_id: companyId },
        select: {
          logo_url: true,
          favicon_url: true,
          logo_sidebar_url: true,
          logo_dark_url: true,
          og_image_url: true,
        },
      }),
      getBucketObjects(forceRefresh),
    ]);

    const bucketIndex = indexBucket(objects);

    // Keys do bucket e caminhos locais legados, por grupo. Set evita contar duas
    // vezes quando dois registros apontam para o mesmo arquivo.
    const bucketKeysByGroup = new Map<string, Set<string>>();
    const localPathsByGroup = new Map<string, Set<string>>();

    const addFile = (group: string, url: string | null | undefined) => {
      if (!url) return;

      const key = MinioService.keyFromUrl(url);
      if (key) {
        const set = bucketKeysByGroup.get(group) ?? new Set<string>();
        set.add(stripExtension(key));
        bucketKeysByGroup.set(group, set);
        return;
      }

      const localPath = localPathFromUrl(url);
      if (localPath) {
        const set = localPathsByGroup.get(group) ?? new Set<string>();
        set.add(localPath);
        localPathsByGroup.set(group, set);
      }
    };

    for (const document of documents) {
      const group = document.property_id ? 'properties' : document.lease_id ? 'leases' : 'other';
      addFile(group, document.file_path);
    }

    for (const url of Object.values(branding ?? {})) {
      addFile('company', url);
    }

    const totals = new Map<string, { bytes: number; files: number }>();

    const accumulate = (group: string, bytes: number, files: number) => {
      const entry = totals.get(group) ?? { bytes: 0, files: 0 };
      entry.bytes += bytes;
      entry.files += files;
      totals.set(group, entry);
    };

    for (const [group, keys] of bucketKeysByGroup) {
      for (const key of keys) {
        const entry = bucketIndex.get(key);
        // Sem par no bucket: registro no banco cujo arquivo já não existe mais.
        // Não soma bytes nem conta como arquivo.
        if (entry) accumulate(group, entry.bytes, entry.files);
      }
    }

    // Legado em disco: são poucos arquivos (anteriores à migração para o MinIO).
    for (const [group, paths] of localPathsByGroup) {
      const stats = await Promise.all(
        [...paths].map((filePath) => fs.stat(filePath).catch(() => null)),
      );
      for (const stat of stats) {
        if (stat?.isFile()) accumulate(group, stat.size, 1);
      }
    }

    // "Outros" só aparece se realmente ocupar espaço (documento sem imóvel nem
    // locação vinculados) — caso contrário o total não fecharia com o storage.
    const groupKeys: string[] = [...FIXED_GROUPS];
    if ((totals.get('other')?.bytes ?? 0) > 0) groupKeys.push('other');

    const groups: StorageUsageGroup[] = groupKeys.map((key) => {
      const entry = totals.get(key) ?? { bytes: 0, files: 0 };
      return {
        key,
        label: GROUP_LABELS[key],
        bytes: entry.bytes,
        megabytes: toMegabytes(entry.bytes),
        files: entry.files,
      };
    });

    const totalBytes = groups.reduce((sum, group) => sum + group.bytes, 0);
    const totalFiles = groups.reduce((sum, group) => sum + group.files, 0);

    return {
      groups,
      totalBytes,
      totalMegabytes: toMegabytes(totalBytes),
      totalFiles,
    };
  }
}
