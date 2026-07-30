import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const leaseFindMany = vi.fn();

vi.mock('../lib/prisma', () => ({
  default: {
    lease: { findMany: (...args: unknown[]) => leaseFindMany(...args) },
  },
}));

import { DashboardService, TENURE_BUCKETS, classifyTenureBucket, tenureInYears } from './DashboardService';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** "Hoje" fixo para que locações em curso tenham tempo determinístico. */
const TODAY = '2026-07-29';

interface LeaseRow {
  id: string;
  contract_number: string;
  start_date: Date;
  end_date: Date;
  canceled_at: Date | null;
  status: string;
  tenant: { name: string } | null;
  property: { title: string } | null;
}

const lease = (
  id: string,
  startDate: string,
  endDate: string,
  status = 'ACTIVE',
  canceledAt: string | null = null
): LeaseRow => ({
  id,
  contract_number: `C-${id}`,
  start_date: utc(startDate),
  end_date: utc(endDate),
  canceled_at: canceledAt ? utc(canceledAt) : null,
  status,
  tenant: { name: `Inquilino ${id}` },
  property: { title: `Imóvel ${id}` },
});

describe('tenureInYears', () => {
  it('conta por aniversário: 12 meses = 1,0 ano com ou sem bissexto no meio', () => {
    // 2024 é bissexto (366 dias); 2025 não (365). Ambos devem dar exatamente 1,0.
    expect(tenureInYears(utc('2023-11-15'), utc('2024-11-15'))).toBe(1);
    expect(tenureInYears(utc('2025-03-15'), utc('2026-03-15'))).toBe(1);
  });

  it('um dia antes do aniversário ainda não completou o ano', () => {
    expect(tenureInYears(utc('2025-03-15'), utc('2026-03-14'))).toBeLessThan(1);
    expect(classifyTenureBucket(tenureInYears(utc('2025-03-15'), utc('2026-03-14')))?.key).toBe('UP_TO_1');
  });

  it('múltiplos anos exatos', () => {
    expect(tenureInYears(utc('2020-01-01'), utc('2026-01-01'))).toBe(6);
    expect(tenureInYears(utc('2023-01-29'), utc('2026-01-29'))).toBe(3);
  });

  it('fração é a parte decorrida do ano-aniversário corrente', () => {
    const y = tenureInYears(utc('2023-01-29'), utc('2026-07-29'));
    expect(y).toBeGreaterThan(3.4);
    expect(y).toBeLessThan(3.6);
    expect(classifyTenureBucket(y)?.label).toBe('De 3 anos até 4 anos');
  });

  it('fim antes do início é negativo (dado inconsistente)', () => {
    expect(tenureInYears(utc('2026-06-01'), utc('2026-02-01'))).toBeLessThan(0);
  });

  it('mesmo dia = 0', () => {
    expect(tenureInYears(utc('2026-07-29'), utc('2026-07-29'))).toBe(0);
  });
});

describe('classifyTenureBucket', () => {
  it('usa limite inferior fechado e superior aberto', () => {
    const cases: [number, string][] = [
      [0, 'Até 1 ano'],
      [0.5, 'Até 1 ano'],
      [0.99, 'Até 1 ano'],
      [1, 'De 1 ano até 2 anos'],
      [1.99, 'De 1 ano até 2 anos'],
      [2, 'De 2 anos até 3 anos'],
      [3, 'De 3 anos até 4 anos'],
      [3.5, 'De 3 anos até 4 anos'],
      [3.99, 'De 3 anos até 4 anos'],
      [4, 'De 4 anos até 5 anos'],
      [5, 'Acima de 5 anos'],
      [5.1, 'Acima de 5 anos'],
      [42, 'Acima de 5 anos'],
    ];

    for (const [years, expected] of cases) {
      expect(classifyTenureBucket(years)?.label, `${years} anos`).toBe(expected);
    }
  });

  it('o caso conhecido do enunciado: 3,5 anos cai em "De 3 anos até 4 anos"', () => {
    expect(classifyTenureBucket(3.5)?.key).toBe('Y3_TO_4');
  });

  it('não classifica tempo negativo', () => {
    expect(classifyTenureBucket(-0.01)).toBeUndefined();
  });

  it('as faixas são contíguas e cobrem de 0 ao infinito', () => {
    expect(TENURE_BUCKETS[0].min).toBe(0);
    expect(TENURE_BUCKETS[TENURE_BUCKETS.length - 1].max).toBe(Infinity);
    for (let i = 1; i < TENURE_BUCKETS.length; i++) {
      expect(TENURE_BUCKETS[i].min).toBe(TENURE_BUCKETS[i - 1].max);
    }
  });
});

describe('DashboardService.getTenantTenureDistribution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(utc(TODAY));
    leaseFindMany.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const rangeStart = utc('2026-01-01');
  const rangeEnd = utc('2026-12-31');

  it('filtra soft-deletes e empurra metade da interseção para o banco', async () => {
    leaseFindMany.mockResolvedValue([]);

    await DashboardService.getTenantTenureDistribution(rangeStart, rangeEnd);

    const args = leaseFindMany.mock.calls[0][0];
    expect(args.where.deleted_at).toBeNull();
    expect(args.where.start_date.lte).toEqual(rangeEnd);
  });

  it('devolve as 6 faixas mesmo vazias, para o eixo não pular faixas', async () => {
    leaseFindMany.mockResolvedValue([]);

    const result = await DashboardService.getTenantTenureDistribution(rangeStart, rangeEnd);

    expect(result.buckets).toHaveLength(6);
    expect(result.buckets.map(b => b.count)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(result.total).toBe(0);
  });

  it('classifica por locação, com fim efetivo por situação', async () => {
    leaseFindMany.mockResolvedValue([
      // Em curso: hoje − início = ~3,50 anos
      lease('L1', '2023-01-29', '2027-01-29', 'ACTIVE'),
      // Em curso: ~0,82 ano
      lease('L2', '2025-10-01', '2026-09-30', 'ACTIVE'),
      // Encerrada: end_date − início = ~6,00 anos
      lease('L3', '2020-01-01', '2026-01-01', 'EXPIRED'),
      // Cancelada: canceled_at manda (2,09 anos), não o end_date previsto (3,00 anos)
      lease('L4', '2024-01-01', '2027-01-01', 'CANCELED', '2026-02-01'),
    ]);

    const result = await DashboardService.getTenantTenureDistribution(rangeStart, rangeEnd);

    const byKey = Object.fromEntries(result.buckets.map(b => [b.key, b.count]));
    expect(byKey).toEqual({
      UP_TO_1: 1,  // L2
      Y1_TO_2: 0,
      Y2_TO_3: 1,  // L4
      Y3_TO_4: 1,  // L1
      Y4_TO_5: 0,
      OVER_5: 1,   // L3
    });

    const byId = Object.fromEntries(result.leases.map(l => [l.id, l]));

    expect(byId.L1.years).toBe(3.5);
    expect(byId.L1.bucketLabel).toBe('De 3 anos até 4 anos');
    expect(byId.L1.situation).toBe('Em curso');
    expect(byId.L1.endDate).toBe(TODAY); // em curso → fim efetivo = hoje

    expect(byId.L3.situation).toBe('Encerrada');
    expect(byId.L3.endDate).toBe('2026-01-01');

    expect(byId.L4.situation).toBe('Cancelada');
    expect(byId.L4.endDate).toBe('2026-02-01');
    expect(byId.L4.bucketKey).toBe('Y2_TO_3');

    // Colunas que alimentam o "Ver Dados Detalhados"
    expect(byId.L1.tenantName).toBe('Inquilino L1');
    expect(byId.L1.propertyTitle).toBe('Imóvel L1');
    expect(byId.L1.contractNumber).toBe('C-L1');
    expect(byId.L1.startDate).toBe('2023-01-29');
  });

  it('a soma das faixas confere com o total de locações consideradas', async () => {
    leaseFindMany.mockResolvedValue([
      lease('L1', '2023-01-29', '2027-01-29', 'ACTIVE'),
      lease('L2', '2025-10-01', '2026-09-30', 'ACTIVE'),
      lease('L3', '2020-01-01', '2026-01-01', 'EXPIRED'),
      lease('L4', '2024-01-01', '2027-01-01', 'CANCELED', '2026-02-01'),
    ]);

    const result = await DashboardService.getTenantTenureDistribution(rangeStart, rangeEnd);

    const soma = result.buckets.reduce((acc, b) => acc + b.count, 0);
    expect(soma).toBe(result.total);
    expect(soma).toBe(result.leases.length);
    expect(soma).toBe(4);
  });

  it('conta duas vezes o inquilino com dois imóveis (unidade = locação)', async () => {
    const duas = [
      { ...lease('A1', '2025-10-01', '2026-09-30', 'ACTIVE'), tenant: { name: 'Mesmo Inquilino' } },
      { ...lease('A2', '2020-01-01', '2026-01-01', 'EXPIRED'), tenant: { name: 'Mesmo Inquilino' } },
    ];
    leaseFindMany.mockResolvedValue(duas);

    const result = await DashboardService.getTenantTenureDistribution(rangeStart, rangeEnd);

    expect(result.total).toBe(2);
    expect(new Set(result.leases.map(l => l.tenantName)).size).toBe(1);
    // caem em faixas diferentes
    expect(result.leases.map(l => l.bucketKey).sort()).toEqual(['OVER_5', 'UP_TO_1']);
  });

  it('descarta locação encerrada antes do período selecionado', async () => {
    leaseFindMany.mockResolvedValue([
      lease('ANTIGA', '2010-01-01', '2012-01-01', 'EXPIRED'), // fim << rangeStart
      lease('VIGENTE', '2025-10-01', '2026-09-30', 'ACTIVE'),
    ]);

    const result = await DashboardService.getTenantTenureDistribution(rangeStart, rangeEnd);

    expect(result.leases.map(l => l.id)).toEqual(['VIGENTE']);
    expect(result.total).toBe(1);
  });

  it('mantém locação antiga que ainda está vigente no período', async () => {
    leaseFindMany.mockResolvedValue([
      lease('LONGA', '2018-05-10', '2028-05-10', 'ACTIVE'),
    ]);

    const result = await DashboardService.getTenantTenureDistribution(rangeStart, rangeEnd);

    expect(result.total).toBe(1);
    // tempo total (não recortado pelo período): 2018-05-10 → hoje
    expect(result.leases[0].years).toBeGreaterThan(8);
    expect(result.leases[0].bucketKey).toBe('OVER_5');
  });

  it('descarta datas inconsistentes (fim antes do início) em vez de somar em "Até 1 ano"', async () => {
    leaseFindMany.mockResolvedValue([
      lease('RUIM', '2026-06-01', '2026-02-01', 'EXPIRED'), // fim < início
      lease('BOA', '2025-10-01', '2026-09-30', 'ACTIVE'),
    ]);

    const result = await DashboardService.getTenantTenureDistribution(rangeStart, rangeEnd);

    expect(result.leases.map(l => l.id)).toEqual(['BOA']);
    expect(result.buckets.find(b => b.key === 'UP_TO_1')?.count).toBe(1);
  });

  it('contratos de 12 meses ficam na MESMA faixa, mesmo cruzando ano bissexto', async () => {
    // Caso real da base: vários contratos de exatamente 12 meses. Com divisão por
    // 365,25 eles se espalhavam entre "Até 1 ano" e "De 1 ano até 2 anos" só por
    // causa do 29/02 — o que não é diferença de permanência nenhuma.
    leaseFindMany.mockResolvedValue([
      lease('BISSEXTO', '2023-11-15', '2024-11-15', 'EXPIRED'), // 366 dias
      lease('COMUM_A', '2025-03-15', '2026-03-15', 'EXPIRED'),  // 365 dias
      lease('COMUM_B', '2025-07-15', '2026-07-15', 'EXPIRED'),  // 365 dias
    ]);

    const result = await DashboardService.getTenantTenureDistribution(
      utc('2023-01-01'),
      utc('2026-12-31')
    );

    expect(result.leases.map(l => l.years)).toEqual([1, 1, 1]);
    expect(new Set(result.leases.map(l => l.bucketKey))).toEqual(new Set(['Y1_TO_2']));
    expect(result.buckets.find(b => b.key === 'Y1_TO_2')?.count).toBe(3);
  });

  it('cancelada sem canceled_at cai no end_date previsto', async () => {
    leaseFindMany.mockResolvedValue([
      lease('SEM_DATA', '2024-01-01', '2026-01-01', 'CANCELED', null),
    ]);

    const result = await DashboardService.getTenantTenureDistribution(rangeStart, rangeEnd);

    expect(result.leases[0].situation).toBe('Cancelada');
    expect(result.leases[0].endDate).toBe('2026-01-01');
    expect(result.leases[0].bucketKey).toBe('Y2_TO_3');
  });
});
