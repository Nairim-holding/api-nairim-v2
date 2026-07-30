import { Decimal } from '@prisma/client/runtime/client';
import prisma from '../lib/prisma';
import { 
  PeriodComparison, 
  FinancialMetrics, 
  PortfolioMetrics, 
  ClientsMetrics,
  GeolocationResponse,
  MetricResult,
  TenantTenureBucketKey,
  TenantTenureDistribution,
  TenantTenureLease
} from '../types/dashboard';

const decimalToNumber = (v: Decimal | number | null | undefined) =>
  v == null ? 0 : v instanceof Decimal ? v.toNumber() : Number(v);

/**
 * Tempo de permanência em anos, por ANIVERSÁRIO DE CALENDÁRIO (não por divisão
 * de dias). Dividir por 365,25 fazia contratos de 12 meses idênticos caírem em
 * faixas diferentes conforme o ano fosse bissexto (366/365,25 = 1,002 → "1 a 2";
 * 365/365,25 = 0,999 → "Até 1 ano"). Aqui, um contrato de 15/03/2025 a
 * 15/03/2026 vale exatamente 1,0 ano, com ou sem 29 de fevereiro no meio.
 *
 * A parte fracionária é a proporção do ano-aniversário corrente já decorrida.
 * Retorna negativo quando o fim é anterior ao início (dado inconsistente).
 */
export const tenureInYears = (start: Date, end: Date): number => {
  if (end.getTime() < start.getTime()) return -1;

  const anniversaryOf = (yearsToAdd: number) =>
    new Date(Date.UTC(start.getUTCFullYear() + yearsToAdd, start.getUTCMonth(), start.getUTCDate()));

  let fullYears = end.getUTCFullYear() - start.getUTCFullYear();
  if (anniversaryOf(fullYears).getTime() > end.getTime()) fullYears -= 1;

  const last = anniversaryOf(fullYears);
  const next = anniversaryOf(fullYears + 1);
  const span = next.getTime() - last.getTime();

  return fullYears + (span > 0 ? (end.getTime() - last.getTime()) / span : 0);
};

/**
 * Faixas de permanência: limite inferior FECHADO, superior ABERTO.
 * Logo 3,5 anos → "De 3 anos até 4 anos"; exatamente 2,0 anos sobe para
 * "De 2 anos até 3 anos". Como as faixas são contíguas e não se sobrepõem,
 * toda locação com tempo >= 0 cai em exatamente uma.
 */
export const TENURE_BUCKETS: { key: TenantTenureBucketKey; label: string; shortLabel: string; min: number; max: number }[] = [
  { key: 'UP_TO_1', label: 'Até 1 ano',            shortLabel: 'Até 1',   min: 0, max: 1 },
  { key: 'Y1_TO_2', label: 'De 1 ano até 2 anos',  shortLabel: '1 a 2',   min: 1, max: 2 },
  { key: 'Y2_TO_3', label: 'De 2 anos até 3 anos', shortLabel: '2 a 3',   min: 2, max: 3 },
  { key: 'Y3_TO_4', label: 'De 3 anos até 4 anos', shortLabel: '3 a 4',   min: 3, max: 4 },
  { key: 'Y4_TO_5', label: 'De 4 anos até 5 anos', shortLabel: '4 a 5',   min: 4, max: 5 },
  { key: 'OVER_5',  label: 'Acima de 5 anos',      shortLabel: 'Acima 5', min: 5, max: Infinity },
];

/**
 * Classifica um tempo de permanência (em anos) em uma das 6 faixas.
 * Retorna `undefined` para tempo negativo (datas inconsistentes), que não
 * pertence a nenhuma faixa.
 */
export const classifyTenureBucket = (years: number) =>
  TENURE_BUCKETS.find(b => years >= b.min && years < b.max);

/** Zera a hora em UTC: compara @db.Date com "hoje" sem erro de 1 dia por fuso. */
const toUtcMidnight = (d: Date): Date => {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

const REQUIRED_DOCUMENT_TYPES = [
  'TITLE_DEED',  
  'REGISTRATION',   
  'PROPERTY_RECORD'
];

const calcVariation = (current: number, previous: number, data?: any[]): MetricResult => {
  if (previous === 0 || !isFinite(previous)) {
    return { 
      result: +current.toFixed(2), 
      variation: 0, 
      isPositive: current >= 0,
      data: data || []
    };
  }
  let variation = ((current - previous) / previous) * 100;
  variation = Math.max(Math.min(variation, 100), -100);
  
  return {
    result: +current.toFixed(2),
    variation: +variation.toFixed(2),
    isPositive: variation >= 0,
    data: data || []
  };
};

export class DashboardService {
  static getPeriodDates(startDate: Date, endDate: Date): PeriodComparison {
    const diffMs = endDate.getTime() - startDate.getTime();
    return {
      current: { start: startDate, end: endDate },
      previous: { 
        start: new Date(startDate.getTime() - diffMs - 1), 
        end: new Date(startDate.getTime() - 1) 
      }
    };
  }

  static calculateVacancyMonths(leases: any[], referenceDate: Date): number {
    if (!leases || leases.length === 0) return 12;
    
    const lastLease = leases[0];
    const leaseEnd = new Date(lastLease.end_date);
    
    if (leaseEnd >= referenceDate) return 0;
    
    const monthsDiff = (referenceDate.getFullYear() - leaseEnd.getFullYear()) * 12;
    return Math.max(0, monthsDiff + (referenceDate.getMonth() - leaseEnd.getMonth()));
  }

  static async getFinancialMetrics(startDate: Date, endDate: Date): Promise<FinancialMetrics> {
    const periods = this.getPeriodDates(startDate, endDate);
    const toNum = (v: any) => decimalToNumber(v);

    const [properties, prevProperties] = await Promise.all([
      prisma.property.findMany({
        where: { created_at: { gte: periods.current.start, lte: periods.current.end }, deleted_at: null },
        include: { 
          type: true, 
          values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
          agency: true,
          owner: true,
          leases: { where: { deleted_at: null }, include: { tenant: true }, orderBy: { end_date: 'desc' }, take: 1 }
        }
      }),
      prisma.property.findMany({
        where: { created_at: { gte: periods.previous.start, lte: periods.previous.end }, deleted_at: null },
        include: { 
          values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
          leases: { where: { deleted_at: null }, orderBy: { end_date: 'desc' }, take: 1 }
        }
      })
    ]);

    const avgRentalData = properties.filter(p => toNum(p.values[0]?.rental_value) > 0).map(p => ({
      id: p.id, title: p.title, rentalValue: toNum(p.values[0]?.rental_value), type: p.type?.description, areaTotal: p.area_total, valuePerSqm: p.area_total > 0 ? +(toNum(p.values[0]?.rental_value) / p.area_total).toFixed(2) : 0, owner: p.owner?.name
    }));
    const prevAvgValue = prevProperties.length > 0 ? prevProperties.reduce((acc, p) => acc + toNum(p.values[0]?.rental_value), 0) / prevProperties.length : 0;

    const activeRentalData = properties.filter(p => toNum(p.values[0]?.rental_value) > 0 && p.values[0]?.status === "AVAILABLE").map(p => ({
      id: p.id, title: p.title, rentalValue: toNum(p.values[0]?.rental_value), status: p.values[0]?.status, type: p.type?.description, agency: p.agency ? { tradeName: p.agency.trade_name } : null, leaseInfo: p.leases[0] ? { contractNumber: p.leases[0].contract_number, tenantName: p.leases[0].tenant?.name } : null
    }));
    const prevTotalRent = prevProperties.reduce((acc, p) => acc + (p.values[0]?.status === "AVAILABLE" ? toNum(p.values[0]?.rental_value) : 0), 0);

    const taxFeeData = properties.filter(p => toNum(p.values[0]?.property_tax) > 0 || toNum(p.values[0]?.condo_fee) > 0).map(p => {
      const total = toNum(p.values[0]?.property_tax) + toNum(p.values[0]?.condo_fee);
      const rent = toNum(p.values[0]?.rental_value);
      return { id: p.id, title: p.title, type: p.type?.description, propertyTax: toNum(p.values[0]?.property_tax), condoFee: toNum(p.values[0]?.condo_fee), totalTaxAndCondo: total, rentalValue: rent, costToRentRatio: rent > 0 ? +((total / rent) * 100).toFixed(2) : 0, impactOnRevenue: rent > 0 ? +((total / rent) * 100).toFixed(2) : 0 };
    });
    const prevTotalTax = prevProperties.reduce((acc, p) => acc + toNum(p.values[0]?.property_tax) + toNum(p.values[0]?.condo_fee), 0);

    const acquisitionData = properties.filter(p => toNum(p.values[0]?.purchase_value) > 0).map(p => {
      const purchase = toNum(p.values[0]?.purchase_value);
      const annualRent = toNum(p.values[0]?.rental_value) * 12;
      return { id: p.id, title: p.title, type: p.type?.description, purchaseValue: purchase, currentStatus: p.values[0]?.status, acquisitionDate: p.values[0]?.created_at, saleValue: toNum(p.values[0]?.sale_value), estimatedAnnualROI: purchase > 0 ? +((annualRent / purchase) * 100).toFixed(2) : 0 };
    });
    const prevTotalAcq = prevProperties.reduce((acc, p) => acc + toNum(p.values[0]?.purchase_value), 0);

    const finVacancyData = properties.filter(p => p.values[0]?.status === "AVAILABLE").map(p => ({
      id: p.id, title: p.title, rentalValue: toNum(p.values[0]?.rental_value), monthsVacant: this.calculateVacancyMonths(p.leases, endDate), estimatedLoss: toNum(p.values[0]?.rental_value) * this.calculateVacancyMonths(p.leases, endDate)
    }));
    const currentFinVacRate = properties.length > 0 ? (finVacancyData.length / properties.length) * 100 : 0;
    const prevFinVacRate = prevProperties.length > 0 ? (prevProperties.filter(p => p.values[0]?.status === "AVAILABLE").length / prevProperties.length) * 100 : 0;

    const vacMonthsData = properties.filter(p => p.values[0]?.status === "AVAILABLE").map(p => ({
      id: p.id, title: p.title, vacancyMonths: this.calculateVacancyMonths(p.leases, endDate), estimatedLoss: toNum(p.values[0]?.rental_value) * this.calculateVacancyMonths(p.leases, endDate)
    }));
    const currentTotalVacMonths = vacMonthsData.reduce((acc, p) => acc + p.vacancyMonths, 0);
    const prevTotalVacMonths = prevProperties.reduce((acc, p) => acc + this.calculateVacancyMonths(p.leases, periods.previous.end), 0);

    return {
      averageRentalTicket: calcVariation(avgRentalData.length > 0 ? avgRentalData.reduce((acc, p) => acc + p.rentalValue, 0) / avgRentalData.length : 0, prevAvgValue, avgRentalData),
      totalRentalActive: calcVariation(activeRentalData.reduce((acc, p) => acc + p.rentalValue, 0), prevTotalRent, activeRentalData),
      totalAcquisitionValue: calcVariation(acquisitionData.reduce((acc, p) => acc + p.purchaseValue, 0), prevTotalAcq, acquisitionData),
      financialVacancyRate: calcVariation(currentFinVacRate, prevFinVacRate, finVacancyData),
      totalPropertyTaxAndCondoFee: calcVariation(taxFeeData.reduce((acc, p) => acc + p.totalTaxAndCondo, 0), prevTotalTax, taxFeeData),
      vacancyInMonths: calcVariation(currentTotalVacMonths, prevTotalVacMonths, vacMonthsData)
    };
  }

  static async getPortfolioMetrics(startDate: Date, endDate: Date): Promise<PortfolioMetrics> {
    const periods = this.getPeriodDates(startDate, endDate);
    const toNum = (v: any) => decimalToNumber(v);

    const [properties, prevProperties] = await Promise.all([
      prisma.property.findMany({
        where: { created_at: { gte: periods.current.start, lte: periods.current.end }, deleted_at: null },
        include: { 
          type: true, 
          values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
          documents: { where: { deleted_at: null } },
          agency: true,
          leases: { where: { deleted_at: null }, orderBy: { end_date: 'desc' }, take: 1 }
        }
      }),
      prisma.property.findMany({
        where: { created_at: { gte: periods.previous.start, lte: periods.previous.end }, deleted_at: null },
        include: { 
          values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 },
          documents: { where: { deleted_at: null } },
          leases: { where: { deleted_at: null }, orderBy: { end_date: 'desc' }, take: 1 }
        }
      })
    ]);

    const allDetails = properties.map(p => ({ id: p.id, title: p.title, type: p.type?.description, status: p.values[0]?.status, rentalValue: toNum(p.values[0]?.rental_value), areaTotal: p.area_total, documentCount: p.documents.length, agency: p.agency ? { tradeName: p.agency.trade_name } : null }));

    const pendingDocs = properties.map(p => {
      const present = p.documents.map(d => d.type);
      const missing = REQUIRED_DOCUMENT_TYPES.filter(t => !present.includes(t as any));
      const isComplete = REQUIRED_DOCUMENT_TYPES.some(t => present.includes(t as any));
      return { id: p.id, title: p.title, documentCount: p.documents.length, type: p.type?.description, missingDocuments: missing, isComplete };
    }).filter(p => !p.isComplete);
    
    const prevPendingCount = prevProperties.filter(p => {
      const present = p.documents.map(d => d.type);
      return !REQUIRED_DOCUMENT_TYPES.some(t => present.includes(t as any));
    }).length;

    const saleValueData = properties.filter(p => toNum(p.values[0]?.sale_value) > 0).map(p => ({ id: p.id, title: p.title, saleValue: toNum(p.values[0]?.sale_value), type: p.type?.description, rentalValue: toNum(p.values[0]?.rental_value) }));

    const available = properties.filter(p => p.values[0]?.status === "AVAILABLE").map(p => ({ id: p.id, title: p.title, type: p.type?.description, rentalValue: toNum(p.values[0]?.rental_value), areaTotal: p.area_total, monthsVacant: this.calculateVacancyMonths(p.leases, endDate) }));
    const occupied = properties.filter(p => p.values[0]?.status !== "AVAILABLE").map(p => ({ id: p.id, title: p.title, type: p.type?.description, rentalValue: toNum(p.values[0]?.rental_value), status: p.values[0]?.status }));
    
    const currentVacRate = properties.length > 0 ? (available.length / properties.length) * 100 : 0;
    const prevVacRate = prevProperties.length > 0 ? (prevProperties.filter(p => p.values[0]?.status === "AVAILABLE").length / prevProperties.length) * 100 : 0;
    
    const currentOccRate = properties.length > 0 ? (occupied.length / properties.length) * 100 : 0;
    const prevOccRate = prevProperties.length > 0 ? (prevProperties.filter(p => p.values[0]?.status !== "AVAILABLE").length / prevProperties.length) * 100 : 0;

    const currentPhysVac = properties.reduce((acc, p) => acc + this.calculateVacancyMonths(p.leases, endDate), 0);
    const prevPhysVac = prevProperties.reduce((acc, p) => acc + this.calculateVacancyMonths(p.leases, periods.previous.end), 0);

    const availablePropertiesByType = Object.entries(
      properties.reduce((acc: Record<string, number>, p) => {
        const type = p.type?.description || "Outros";
        if (p.values[0]?.status === "AVAILABLE") acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ 
      name, value, data: available.filter(p => p.type === name)
    }));

    return {
      totalPropertys: calcVariation(properties.length, prevProperties.length, allDetails),
      countPropertiesWithLessThan3Docs: calcVariation(pendingDocs.length, prevPendingCount, pendingDocs),
      totalPropertiesWithSaleValue: calcVariation(saleValueData.length, prevProperties.filter(p => toNum(p.values[0]?.sale_value) > 0).length, saleValueData),
      availablePropertiesByType,
      vacancyRate: calcVariation(currentVacRate, prevVacRate, available),
      occupationRate: calcVariation(currentOccRate, prevOccRate, occupied),
      physicalVacancy: calcVariation(currentPhysVac, prevPhysVac, properties.map(p => ({ id: p.id, title: p.title, vacancyMonths: this.calculateVacancyMonths(p.leases, endDate) })))
    };
  }

  static async getClientsMetrics(startDate: Date, endDate: Date): Promise<ClientsMetrics> {
    const periods = this.getPeriodDates(startDate, endDate);
    const toNum = (v: any) => decimalToNumber(v);

    const [owners, prevOwnersCount, tenants, prevTenantsCount, agencies, prevAgenciesCount] = await Promise.all([
      prisma.owner.findMany({
        where: { created_at: { gte: periods.current.start, lte: periods.current.end }, deleted_at: null },
        include: {
          properties: {
            where: { deleted_at: null },
            include: {
              type: true,
              values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 }
            }
          }
        }
      }),
      prisma.owner.count({ where: { created_at: { gte: periods.previous.start, lte: periods.previous.end }, deleted_at: null } }),

      prisma.tenant.findMany({
        where: { created_at: { gte: periods.current.start, lte: periods.current.end }, deleted_at: null },
        include: {
          leases: {
            where: { deleted_at: null },
            include: {
              property: {
                include: {
                  type: true,
                  values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 }
                }
              }
            }
          }
        }
      }),
      prisma.tenant.count({ where: { created_at: { gte: periods.previous.start, lte: periods.previous.end }, deleted_at: null } }),

      prisma.agency.findMany({
        where: { created_at: { gte: periods.current.start, lte: periods.current.end }, deleted_at: null },
        include: {
          properties: {
            where: { deleted_at: null },
            include: {
              type: true,
              values: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1 }
            }
          }
        }
      }),
      prisma.agency.count({ where: { created_at: { gte: periods.previous.start, lte: periods.previous.end }, deleted_at: null } })
    ]);

    const ownersDetails = owners.map(o => ({
      id: o.id,
      name: o.name,
      createdAt: o.created_at,
      propertiesCount: o.properties.length,
      properties: o.properties.map(p => ({
        id: p.id,
        title: p.title,
        type: p.type?.description,
        status: p.values[0]?.status,
        rentalValue: toNum(p.values[0]?.rental_value),
        saleValue: toNum(p.values[0]?.sale_value)
      }))
    }));

    const tenantsDetails = tenants.map(t => ({
      id: t.id,
      name: t.name,
      createdAt: t.created_at,
      properties: t.leases.map(l => ({
        id: l.property.id,
        title: l.property.title,
        type: l.property.type?.description,
        contractNumber: l.contract_number,
        rentalValue: toNum(l.rent_amount)
      }))
    }));

    const agenciesDetails = agencies.map(a => ({
      id: a.id,
      legalName: a.legal_name,
      tradeName: a.trade_name,
      createdAt: a.created_at,
      propertiesCount: a.properties.length
    }));

    const totalProperties = owners.reduce((acc, o) => acc + o.properties.length, 0);
    const propertiesPerOwnerVal = owners.length > 0 ? totalProperties / owners.length : 0;
    
    const prevTotalPropertiesEstimate = prevOwnersCount * propertiesPerOwnerVal; 
    const prevPropertiesPerOwnerVal = prevOwnersCount > 0 ? prevTotalPropertiesEstimate / prevOwnersCount : 0;

    return {
      ownersTotal: calcVariation(owners.length, prevOwnersCount, ownersDetails),
      
      tenantsTotal: calcVariation(tenants.length, prevTenantsCount, tenantsDetails),
      
      propertiesPerOwner: calcVariation(propertiesPerOwnerVal, prevPropertiesPerOwnerVal, ownersDetails), 
      
      agenciesTotal: calcVariation(agencies.length, prevAgenciesCount, agenciesDetails),

      propertiesByAgency: agencies.map(a => ({
        name: a.trade_name || a.legal_name,
        value: a.properties.length,
        data: a.properties.map(p => ({
          id: p.id,
          title: p.title,
          type: p.type?.description,
          status: p.values[0]?.status,
          rentalValue: toNum(p.values[0]?.rental_value),
          areaTotal: p.area_total,
          agency: {
            id: a.id,
            tradeName: a.trade_name,
            legalName: a.legal_name
          }
        }))
      }))
    };
  }

  /**
   * Distribuição das locações por tempo de permanência do inquilino no imóvel.
   *
   * Unidade de contagem: a LOCAÇÃO (contrato), não o inquilino — um inquilino com
   * dois imóveis conta duas vezes e pode cair em faixas diferentes. É o que casa
   * 1:1 com o grid detalhado (uma linha por locação) e garante
   * `soma dos buckets === leases.length`.
   *
   * Fim efetivo da locação:
   *  - CANCELED com `canceled_at` → `canceled_at` (fim real, não o previsto)
   *  - `end_date` já passou       → `end_date`    (encerrada)
   *  - caso contrário             → hoje          (em curso)
   *
   * O período recebido filtra QUEM aparece (locações vigentes no período, isto é,
   * cujo intervalo intersecta [startDate, endDate]), mas não recorta o tempo:
   * o tempo exibido é sempre a permanência total da locação.
   */
  static async getTenantTenureDistribution(startDate: Date, endDate: Date): Promise<TenantTenureDistribution> {
    // Datas do banco são @db.Date (meia-noite UTC). Normalizar "hoje" para
    // meia-noite UTC evita erro de 1 dia por causa do fuso do servidor.
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const rangeStart = toUtcMidnight(startDate);
    const rangeEnd = toUtcMidnight(endDate);

    // `start_date <= rangeEnd` é a metade da interseção que dá para empurrar para o
    // banco; a outra metade depende do fim efetivo (calculado abaixo, em JS).
    const leases = await prisma.lease.findMany({
      where: { deleted_at: null, start_date: { lte: rangeEnd } },
      select: {
        id: true,
        contract_number: true,
        start_date: true,
        end_date: true,
        canceled_at: true,
        status: true,
        tenant: { select: { name: true } },
        property: { select: { title: true } },
      },
      orderBy: { start_date: 'asc' },
    });

    const rows: TenantTenureLease[] = [];

    for (const lease of leases) {
      const start = toUtcMidnight(lease.start_date);

      let effectiveEnd: Date;
      let situation: TenantTenureLease['situation'];

      if (lease.status === 'CANCELED' && lease.canceled_at) {
        effectiveEnd = toUtcMidnight(lease.canceled_at);
        situation = 'Cancelada';
      } else if (toUtcMidnight(lease.end_date) < today) {
        effectiveEnd = toUtcMidnight(lease.end_date);
        situation = lease.status === 'CANCELED' ? 'Cancelada' : 'Encerrada';
      } else {
        effectiveEnd = today;
        situation = lease.status === 'CANCELED' ? 'Cancelada' : 'Em curso';
      }

      // Segunda metade da interseção com o período selecionado.
      if (effectiveEnd < rangeStart) continue;

      // Datas inconsistentes (fim antes do início) geram tempo negativo, que não
      // pertence a nenhuma faixa — fora do gráfico em vez de poluir "Até 1 ano".
      const years = tenureInYears(start, effectiveEnd);
      if (years < 0) continue;

      const bucket = classifyTenureBucket(years)!;

      rows.push({
        id: lease.id,
        tenantName: lease.tenant?.name ?? '—',
        propertyTitle: lease.property?.title ?? '—',
        contractNumber: lease.contract_number,
        startDate: toIsoDate(start),
        endDate: toIsoDate(effectiveEnd),
        situation,
        years: +years.toFixed(2),
        bucketKey: bucket.key,
        bucketLabel: bucket.label,
      });
    }

    const buckets = TENURE_BUCKETS.map(b => ({
      key: b.key,
      label: b.label,
      shortLabel: b.shortLabel,
      count: rows.filter(r => r.bucketKey === b.key).length,
    }));

    return { buckets, leases: rows, total: rows.length };
  }

  static async getGeolocation(startDate: Date, endDate: Date): Promise<GeolocationResponse> {
    const properties = await prisma.property.findMany({
      where: { created_at: { gte: startDate, lte: endDate }, deleted_at: null },
      include: { addresses: { where: { deleted_at: null }, include: { address: true } } }
    });

    const coordinates = properties.flatMap(p => p.addresses.map(a => {
      const lat = a.address.latitude;
      const lng = a.address.longitude;
      
      if (lat != null && lng != null) {
        return {
          lat,
          lng,
          info: `${p.title} (${a.address.city}/${a.address.state})`
        };
      }
      return null;
    })).filter(coord => coord !== null) as { lat: number; lng: number; info: string }[];

    return { coordinates };
  }
}