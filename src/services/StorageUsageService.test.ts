import { describe, it, expect, beforeEach, vi } from 'vitest';

const PREFIX = 'https://cdn.test/bucket/';

const documentFindMany = vi.fn();
const companyBrandingFindUnique = vi.fn();
const listAllObjects = vi.fn();
const stat = vi.fn();
const queryRaw = vi.fn();

vi.mock('../lib/prisma', () => ({
  default: {
    document: { findMany: (...args: unknown[]) => documentFindMany(...args) },
    companyBranding: { findUnique: (...args: unknown[]) => companyBrandingFindUnique(...args) },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

vi.mock('../lib/minioService', () => ({
  MinioService: {
    listAllObjects: (...args: unknown[]) => listAllObjects(...args),
    keyFromUrl: (url: string) => (url.startsWith(PREFIX) ? url.slice(PREFIX.length) : null),
  },
}));

vi.mock('fs/promises', () => ({
  default: { stat: (...args: unknown[]) => stat(...args) },
}));

import { StorageUsageService, invalidateStorageUsageCache } from './StorageUsageService';

const MB = 1024 * 1024;
const url = (key: string) => `${PREFIX}${key}`;
const propertyDoc = (key: string) => ({ file_path: url(key), property_id: 'prop-1', lease_id: null, transaction_id: null });
const leaseDoc = (key: string) => ({ file_path: url(key), property_id: null, lease_id: 'lease-1', transaction_id: null });
const transactionDoc = (key: string) => ({ file_path: url(key), property_id: null, lease_id: null, transaction_id: 'txn-1' });
const groupOf = <T extends { key: string }>(groups: T[], key: string): T => groups.find((g) => g.key === key)!;

/** Carimbo do estado das mídias: muda quando um documento entra/sai ou o branding é alterado. */
const stampOf = (docs: number, docsLastMs = 1_000, brandingLastMs = 1_000) =>
  queryRaw.mockResolvedValue([
    {
      docs: BigInt(docs),
      docs_last: new Date(docsLastMs),
      branding_last: new Date(brandingLastMs),
    },
  ]);

const noBranding = () =>
  companyBrandingFindUnique.mockResolvedValue({
    logo_url: null,
    favicon_url: null,
    logo_sidebar_url: null,
    logo_dark_url: null,
    og_image_url: null,
  });

describe('StorageUsageService.getStorageUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateStorageUsageCache();
    stat.mockRejectedValue(new Error('ENOENT'));
    noBranding();
    stampOf(1);
  });

  it('agrupa por local de armazenamento e o total fecha com a soma dos grupos', async () => {
    documentFindMany.mockResolvedValue([
      propertyDoc('properties/prop-1/foto.avif'),
      propertyDoc('properties/images/matricula.pdf'),
      leaseDoc('leases/documents/contrato.pdf'),
    ]);
    companyBrandingFindUnique.mockResolvedValue({
      logo_url: url('companies/company-1/logo.png'),
      favicon_url: null,
      logo_sidebar_url: null,
      logo_dark_url: null,
      og_image_url: null,
    });
    listAllObjects.mockResolvedValue([
      { key: 'properties/prop-1/foto.avif', size: 20 * MB },
      { key: 'properties/images/matricula.pdf', size: 2.34 * MB },
      { key: 'leases/documents/contrato.pdf', size: 50.3 * MB },
      { key: 'companies/company-1/logo.png', size: 0.5 * MB },
    ]);

    const usage = await StorageUsageService.getStorageUsage('company-1');

    expect(groupOf(usage.groups, 'properties')).toMatchObject({ label: 'Imóveis', megabytes: 22.34, files: 2 });
    expect(groupOf(usage.groups, 'leases')).toMatchObject({ label: 'Locações', megabytes: 50.3, files: 1 });
    expect(groupOf(usage.groups, 'company')).toMatchObject({ label: 'Identidade Visual', megabytes: 0.5, files: 1 });

    const sumOfGroups = usage.groups.reduce((sum, group) => sum + group.bytes, 0);
    expect(sumOfGroups).toBe(usage.totalBytes);
    expect(usage.totalMegabytes).toBe(73.14);
    expect(usage.totalFiles).toBe(4);
  });

  it('casa o registro do banco com o objeto convertido para AVIF (extensão diferente)', async () => {
    // O upload grava .jpg no banco; a conversão em background troca o objeto por .avif
    // e apaga o original, sem atualizar o file_path em parte dos fluxos.
    documentFindMany.mockResolvedValue([propertyDoc('properties/prop-1/1700000000-foto.jpg')]);
    listAllObjects.mockResolvedValue([
      { key: 'properties/prop-1/1700000000-foto.avif', size: 3 * MB },
    ]);

    const usage = await StorageUsageService.getStorageUsage('company-1');

    expect(groupOf(usage.groups, 'properties').megabytes).toBe(3);
  });

  it('ignora documento cujo arquivo não existe mais no bucket', async () => {
    documentFindMany.mockResolvedValue([propertyDoc('properties/prop-1/sumiu.pdf')]);
    listAllObjects.mockResolvedValue([]);

    const usage = await StorageUsageService.getStorageUsage('company-1');

    expect(groupOf(usage.groups, 'properties')).toMatchObject({ bytes: 0, files: 0 });
    expect(usage.totalBytes).toBe(0);
  });

  it('não conta o mesmo arquivo duas vezes quando dois registros apontam para ele', async () => {
    documentFindMany.mockResolvedValue([
      propertyDoc('properties/prop-1/foto.jpg'),
      propertyDoc('properties/prop-1/foto.jpg'),
    ]);
    listAllObjects.mockResolvedValue([{ key: 'properties/prop-1/foto.jpg', size: 4 * MB }]);

    const usage = await StorageUsageService.getStorageUsage('company-1');

    expect(groupOf(usage.groups, 'properties')).toMatchObject({ megabytes: 4, files: 1 });
  });

  it('soma arquivos legados servidos do disco local', async () => {
    documentFindMany.mockResolvedValue([
      { file_path: 'http://localhost:5000/uploads/properties/antigo.pdf', property_id: 'prop-1', lease_id: null },
    ]);
    listAllObjects.mockResolvedValue([]);
    stat.mockResolvedValue({ isFile: () => true, size: 1.5 * MB });

    const usage = await StorageUsageService.getStorageUsage('company-1');

    expect(groupOf(usage.groups, 'properties')).toMatchObject({ megabytes: 1.5, files: 1 });
  });

  it('mostra "Outros" apenas quando há documento sem imóvel nem locação ocupando espaço', async () => {
    documentFindMany.mockResolvedValue([propertyDoc('properties/prop-1/foto.jpg')]);
    listAllObjects.mockResolvedValue([{ key: 'properties/prop-1/foto.jpg', size: 1 * MB }]);

    const semOutros = await StorageUsageService.getStorageUsage('company-1');
    expect(semOutros.groups.map((g) => g.key)).toEqual(['properties', 'leases', 'transactions', 'company']);

    invalidateStorageUsageCache();
    documentFindMany.mockResolvedValue([
      { file_path: url('properties/documents/solto.pdf'), property_id: null, lease_id: null, transaction_id: null },
    ]);
    listAllObjects.mockResolvedValue([{ key: 'properties/documents/solto.pdf', size: 1 * MB }]);

    const comOutros = await StorageUsageService.getStorageUsage('company-1');
    expect(groupOf(comOutros.groups, 'other')).toMatchObject({ label: 'Outros', megabytes: 1 });
    expect(comOutros.totalMegabytes).toBe(1);
  });

  it('agrupa anexos de lançamentos financeiros em "transactions"', async () => {
    documentFindMany.mockResolvedValue([transactionDoc('transactions/attachments/boleto.pdf')]);
    listAllObjects.mockResolvedValue([{ key: 'transactions/attachments/boleto.pdf', size: 1 * MB }]);

    const usage = await StorageUsageService.getStorageUsage('company-1');

    expect(groupOf(usage.groups, 'transactions')).toMatchObject({ label: 'Lançamentos Financeiros', megabytes: 1, files: 1 });
  });

  it('reflete um anexo novo imediatamente, sem esperar o TTL do cache', async () => {
    documentFindMany.mockResolvedValue([leaseDoc('leases/documents/contrato.pdf')]);
    listAllObjects.mockResolvedValue([{ key: 'leases/documents/contrato.pdf', size: 2 * MB }]);
    stampOf(1);

    const antes = await StorageUsageService.getStorageUsage('company-1');
    expect(groupOf(antes.groups, 'leases')).toMatchObject({ megabytes: 2, files: 1 });
    expect(listAllObjects).toHaveBeenCalledTimes(1);

    // Anexo enviado logo depois: o carimbo muda, então o inventário é refeito
    // na hora — este é o caso que antes ficava congelado até o TTL expirar.
    documentFindMany.mockResolvedValue([
      leaseDoc('leases/documents/contrato.pdf'),
      leaseDoc('leases/documents/aditivo.pdf'),
    ]);
    listAllObjects.mockResolvedValue([
      { key: 'leases/documents/contrato.pdf', size: 2 * MB },
      { key: 'leases/documents/aditivo.pdf', size: 3 * MB },
    ]);
    stampOf(2, 2_000);

    const depois = await StorageUsageService.getStorageUsage('company-1');
    expect(groupOf(depois.groups, 'leases')).toMatchObject({ megabytes: 5, files: 2 });
    expect(groupOf(depois.groups, 'properties').megabytes).toBe(0);
    expect(listAllObjects).toHaveBeenCalledTimes(2);
  });

  it('reflete um logo novo da empresa, que não passa pela tabela Document', async () => {
    documentFindMany.mockResolvedValue([]);
    noBranding();
    listAllObjects.mockResolvedValue([{ key: 'companies/company-1/logo.png', size: 1 * MB }]);
    stampOf(0);

    const antes = await StorageUsageService.getStorageUsage('company-1');
    expect(groupOf(antes.groups, 'company')).toMatchObject({ megabytes: 0, files: 0 });

    // Upload de logo altera CompanyBranding, não Document: sem o branding no
    // carimbo, o grupo "Empresa" ficaria zerado até o TTL expirar.
    companyBrandingFindUnique.mockResolvedValue({
      logo_url: url('companies/company-1/logo.png'),
      favicon_url: null,
      logo_sidebar_url: null,
      logo_dark_url: null,
      og_image_url: null,
    });
    stampOf(0, 1_000, 2_000);

    const depois = await StorageUsageService.getStorageUsage('company-1');
    expect(groupOf(depois.groups, 'company')).toMatchObject({ megabytes: 1, files: 1 });
    expect(listAllObjects).toHaveBeenCalledTimes(2);
  });

  it('não revarre o bucket enquanto os anexos não mudam', async () => {
    documentFindMany.mockResolvedValue([leaseDoc('leases/documents/contrato.pdf')]);
    listAllObjects.mockResolvedValue([{ key: 'leases/documents/contrato.pdf', size: 2 * MB }]);
    stampOf(1);

    await StorageUsageService.getStorageUsage('company-1');
    await StorageUsageService.getStorageUsage('company-1');
    await StorageUsageService.getStorageUsage('company-1');

    expect(listAllObjects).toHaveBeenCalledTimes(1);
  });

  it('mantém o número cacheado se a conferência do carimbo falhar', async () => {
    documentFindMany.mockResolvedValue([leaseDoc('leases/documents/contrato.pdf')]);
    listAllObjects.mockResolvedValue([{ key: 'leases/documents/contrato.pdf', size: 2 * MB }]);
    stampOf(1);

    await StorageUsageService.getStorageUsage('company-1');

    queryRaw.mockRejectedValue(new Error('banco indisponível'));
    const usage = await StorageUsageService.getStorageUsage('company-1');

    expect(groupOf(usage.groups, 'leases').megabytes).toBe(2);
    expect(listAllObjects).toHaveBeenCalledTimes(1);
  });

  it('varre o bucket uma única vez para leituras concorrentes com cache frio', async () => {
    documentFindMany.mockResolvedValue([]);
    listAllObjects.mockResolvedValue([]);

    await Promise.all([
      StorageUsageService.getStorageUsage('company-1'),
      StorageUsageService.getStorageUsage('company-2'),
      StorageUsageService.getStorageUsage('company-3'),
    ]);

    expect(listAllObjects).toHaveBeenCalledTimes(1);
  });
});
