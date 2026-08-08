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
  transactions: 'Lançamentos Financeiros',
  company: 'Identidade Visual',
  other: 'Outros',
};

const FIXED_GROUPS = ['properties', 'leases', 'transactions', 'company'] as const;

/**
 * Cache do inventário do bucket, por empresa. É por empresa porque a listagem
 * do bucket retorna tudo, mas cada empresa só vê seus próprios documentos.
 * Sem isso, cada abertura do dashboard pagaria uma varredura completa.
 *
 * O TTL sozinho não basta: um anexo enviado agora só apareceria no gráfico
 * quando a janela expirasse. Por isso o cache também guarda um "carimbo" do
 * estado das mídias (ver getMediaStamp); se ele mudou, a varredura é refeita na
 * hora. O carimbo é uma agregação de poucos milissegundos — bem mais barato que
 * listar o bucket a cada requisição.
 */
const BUCKET_CACHE_TTL_MS = 5 * 60 * 1000;
const bucketCacheByCompany = new Map<string, { objects: MinioObjectInfo[]; fetchedAt: number; stamp: string }>();
const bucketInFlightByCompany = new Map<string, Promise<MinioObjectInfo[]>>();

export function invalidateStorageUsageCache(companyId?: string): void {
  if (companyId) {
    bucketCacheByCompany.delete(companyId);
    bucketInFlightByCompany.delete(companyId);
  } else {
    bucketCacheByCompany.clear();
    bucketInFlightByCompany.clear();
  }
}

/**
 * Assinatura barata do estado dos anexos da empresa. Cobre as duas origens de
 * mídia: `Document` (imóveis e locações) e `CompanyBranding` (logo, favicon e
 * demais assets da empresa) — sem a segunda, subir um logo não invalidaria o
 * cache e o grupo "Empresa" ficaria parado.
 *
 * Vai por $queryRaw para filtrar por company_id explicitamente, já que essa é a
 * única maneira de garantir que o cache respeita os limites de multi-tenant.
 */
async function getMediaStamp(companyId: string): Promise<string> {
  const rows = await prisma.$queryRaw<
    Array<{ docs: bigint; docs_last: Date | null; branding_last: Date | null }>
  >`
    SELECT (SELECT COUNT(*)::bigint    FROM "Document" WHERE company_id = ${companyId} AND deleted_at IS NULL) AS docs,
           (SELECT MAX(updated_at)     FROM "Document" WHERE company_id = ${companyId} AND deleted_at IS NULL) AS docs_last,
           (SELECT MAX(updated_at)     FROM "CompanyBranding" WHERE company_id = ${companyId})                    AS branding_last
  `;

  const row = rows[0];
  return [
    row?.docs ?? 0,
    row?.docs_last?.getTime() ?? 0,
    row?.branding_last?.getTime() ?? 0,
  ].join(':');
}

async function getBucketObjects(companyId: string, forceRefresh: boolean): Promise<MinioObjectInfo[]> {
  if (forceRefresh) bucketCacheByCompany.delete(companyId);

  const cachedEntry = bucketCacheByCompany.get(companyId);
  if (cachedEntry && Date.now() - cachedEntry.fetchedAt < BUCKET_CACHE_TTL_MS) {
    // Se um anexo entrou ou saiu desde a varredura, o cache está velho mesmo
    // dentro do TTL. Falha na conferência não derruba a resposta: nesse caso
    // vale mais servir o número cacheado do que quebrar o gráfico.
    const stamp = await getMediaStamp(companyId).catch(() => cachedEntry?.stamp);
    if (stamp === cachedEntry.stamp) return cachedEntry.objects;
    bucketCacheByCompany.delete(companyId);
  }

  // Requisições concorrentes com o cache frio compartilham a mesma varredura.
  if (!bucketInFlightByCompany.has(companyId)) {
    const inFlight = Promise.all([MinioService.listAllObjects(), getMediaStamp(companyId)])
      .then(([objects, stamp]) => {
        bucketCacheByCompany.set(companyId, { objects, fetchedAt: Date.now(), stamp });
        return objects;
      })
      .finally(() => {
        bucketInFlightByCompany.delete(companyId);
      });
    bucketInFlightByCompany.set(companyId, inFlight);
  }

  return bucketInFlightByCompany.get(companyId)!;
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
        select: { file_path: true, property_id: true, lease_id: true, transaction_id: true },
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
      getBucketObjects(companyId, forceRefresh),
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
      const group = document.property_id
        ? 'properties'
        : document.lease_id
        ? 'leases'
        : document.transaction_id
        ? 'transactions'
        : 'other';
      addFile(group, document.file_path);
    }

    // Debug: log quantos documentos e keys foram encontrados
    if (documents.length > 0) {
      console.log(`[StorageUsageService] companyId=${companyId}: ${documents.length} documentos, ${bucketKeysByGroup.size} grupos com keys, ${objects.length} objetos no bucket`);
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
