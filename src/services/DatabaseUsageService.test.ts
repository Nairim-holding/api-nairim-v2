import { describe, it, expect, beforeEach, vi } from 'vitest';

const queryRaw = vi.fn();
const companyFindMany = vi.fn();

vi.mock('../lib/prisma', () => ({
  default: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
    company: { findMany: (...args: unknown[]) => companyFindMany(...args) },
  },
}));

vi.mock('@/generated/prisma/client', () => ({
  Prisma: { raw: (sql: string) => sql },
}));

vi.mock('@/env', () => ({
  env: { DEFAULT_DB_QUOTA_MB: 10 },
}));

import { DatabaseUsageService, invalidateDatabaseUsageCache } from './DatabaseUsageService';

const MB = 1024 * 1024;

const company = (id: string, name: string, quota: number | null = null) => ({
  id,
  name,
  db_quota_mb: quota,
});

describe('DatabaseUsageService.getDatabaseUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateDatabaseUsageCache();
  });

  it('calcula usado/contratado e o percentual da empresa em contexto', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Acme')]);
    queryRaw.mockResolvedValue([{ company_id: 'c1', bytes: BigInt(Math.round(4.06 * MB)) }]);

    const usage = await DatabaseUsageService.getDatabaseUsage('c1');

    expect(usage.current).toMatchObject({
      companyName: 'Acme',
      usedMb: 4.06,
      quotaMb: 10,
      percent: 40.6,
      isCurrent: true,
    });
  });

  it('soma as parcelas da mesma empresa vindas de tabelas diferentes', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Acme')]);
    queryRaw.mockResolvedValue([
      { company_id: 'c1', bytes: BigInt(1 * MB) },
      { company_id: 'c1', bytes: BigInt(2 * MB) },
      { company_id: 'c1', bytes: BigInt(0.5 * MB) },
    ]);

    const usage = await DatabaseUsageService.getDatabaseUsage('c1');

    expect(usage.current?.usedMb).toBe(3.5);
  });

  it('usa a cota da empresa quando definida e o default do ambiente quando nula', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Com cota', 50), company('c2', 'Sem cota')]);
    queryRaw.mockResolvedValue([
      { company_id: 'c1', bytes: BigInt(5 * MB) },
      { company_id: 'c2', bytes: BigInt(5 * MB) },
    ]);

    const usage = await DatabaseUsageService.getDatabaseUsage('c1');

    const comCota = usage.companies.find((c) => c.companyId === 'c1');
    const semCota = usage.companies.find((c) => c.companyId === 'c2');

    expect(comCota).toMatchObject({ quotaMb: 50, percent: 10 });
    expect(semCota).toMatchObject({ quotaMb: 10, percent: 50 });
  });

  it('marca apenas a empresa em contexto como current e devolve todas no comparativo', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Acme'), company('c2', 'Globex')]);
    queryRaw.mockResolvedValue([
      { company_id: 'c1', bytes: BigInt(1 * MB) },
      { company_id: 'c2', bytes: BigInt(2 * MB) },
    ]);

    const usage = await DatabaseUsageService.getDatabaseUsage('c2');

    expect(usage.current?.companyId).toBe('c2');
    expect(usage.companies).toHaveLength(2);
    expect(usage.companies.filter((c) => c.isCurrent)).toHaveLength(1);
  });

  it('ignora linhas órfãs sem empresa identificável', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Acme')]);
    queryRaw.mockResolvedValue([
      { company_id: 'c1', bytes: BigInt(1 * MB) },
      { company_id: null, bytes: BigInt(99 * MB) },
    ]);

    const usage = await DatabaseUsageService.getDatabaseUsage('c1');

    expect(usage.current?.usedMb).toBe(1);
  });

  it('devolve zero em vez de dividir por zero quando a cota é zero', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Acme', 0)]);
    queryRaw.mockResolvedValue([{ company_id: 'c1', bytes: BigInt(5 * MB) }]);

    const usage = await DatabaseUsageService.getDatabaseUsage('c1');

    expect(usage.current?.percent).toBe(0);
    expect(usage.current?.usedMb).toBe(5);
  });

  it('reporta acima de 100% quando o uso passa da cota contratada', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Acme', 4)]);
    queryRaw.mockResolvedValue([{ company_id: 'c1', bytes: BigInt(5 * MB) }]);

    const usage = await DatabaseUsageService.getDatabaseUsage('c1');

    expect(usage.current).toMatchObject({ usedMb: 5, quotaMb: 4, percent: 125 });
  });

  it('serve do cache e só refaz a medição com refresh', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Acme')]);
    queryRaw.mockResolvedValue([{ company_id: 'c1', bytes: BigInt(1 * MB) }]);

    await DatabaseUsageService.getDatabaseUsage('c1');
    await DatabaseUsageService.getDatabaseUsage('c1');
    expect(queryRaw).toHaveBeenCalledTimes(1);

    queryRaw.mockResolvedValue([{ company_id: 'c1', bytes: BigInt(3 * MB) }]);
    const atualizado = await DatabaseUsageService.getDatabaseUsage('c1', true);

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(atualizado.current?.usedMb).toBe(3);
  });

  it('executa uma única medição para leituras concorrentes com cache frio', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Acme'), company('c2', 'Globex')]);
    queryRaw.mockResolvedValue([{ company_id: 'c1', bytes: BigInt(1 * MB) }]);

    await Promise.all([
      DatabaseUsageService.getDatabaseUsage('c1'),
      DatabaseUsageService.getDatabaseUsage('c2'),
      DatabaseUsageService.getDatabaseUsage('c1'),
    ]);

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('cobre todas as tabelas do schema com company_id na consulta', async () => {
    companyFindMany.mockResolvedValue([company('c1', 'Acme')]);
    queryRaw.mockResolvedValue([]);

    await DatabaseUsageService.getDatabaseUsage('c1');

    const sql = queryRaw.mock.calls[0][0] as string;
    // Tabelas diretas, filhas via JOIN e os dois casos especiais.
    for (const table of ['Transaction', 'invoices', 'Document', 'CompanyBranding', 'PlanningMonth', 'Contact', 'Address']) {
      expect(sql).toContain(`"${table}"`);
    }
    // Address entra por DISTINCT ON para não contar o mesmo endereço duas vezes.
    expect(sql).toContain('DISTINCT ON (a.id)');
    // Medição é somente leitura.
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
  });
});
