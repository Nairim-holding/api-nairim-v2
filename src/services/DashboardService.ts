// src/services/DashboardService.ts
import { Decimal } from '@prisma/client/runtime/client';
import prisma from '../lib/prisma';
import { 
  PeriodComparison, 
  FinancialMetrics, 
  PortfolioMetrics, 
  ClientsMetrics, 
  GeolocationResponse,
  MetricResult
} from '../types/dashboard';

// Helper para converter Decimal do Prisma para Number
const decimalToNumber = (v: Decimal | number | null | undefined) =>
  v == null ? 0 : v instanceof Decimal ? v.toNumber() : Number(v);

const REQUIRED_DOCUMENT_TYPES = [
  'TITLE_DEED',      // Escritura
  'REGISTRATION',    // Matrícula
  'PROPERTY_RECORD'  // Registro do Imóvel
];

// Helper para calcular variação percentual
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
  // Limitar variação para evitar distorções visuais extremas (opcional, mas recomendado)
  variation = Math.max(Math.min(variation, 100), -100);
  
  return {
    result: +current.toFixed(2),
    variation: +variation.toFixed(2),
    isPositive: variation >= 0,
    data: data || []
  };
};

// Helper para buscar coordenadas (Geocoding)
async function fetchCoordinatesBatch(
  addresses: {
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    country?: string;
    title: string;
  }[],
  concurrency = 3
) {
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const results: { lat: number; lng: number; info: string }[] = [];
  let active = 0;

  async function worker(addr: any) {
    const fullAddress = `${addr.street}, ${addr.number}, ${addr.city}, ${addr.state}, ${addr.country}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "NairimAPI/1.0",
          "Accept-Language": "pt-BR",
          Accept: "application/json",
        },
      });

      if (!res.ok) return;
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        results.push({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          info: `${addr.title} (${addr.city}/${addr.state})`,
        });
      }
    } catch (err) {
      console.error("❌ Erro coordenadas:", err);
    } finally {
      active--;
    }
  }

  for (const addr of addresses) {
    while (active >= concurrency) await delay(300); 
    active++;
    worker(addr);
  }

  while (active > 0) await delay(500);
  return results;
}

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
    if (!leases || leases.length === 0) return 12; // Se nunca foi alugado, assume-se 12 meses de vacância para métrica simplificada
    
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

    // 1. Ticket Médio
    const avgRentalData = properties.filter(p => toNum(p.values[0]?.rental_value) > 0).map(p => ({
      id: p.id, title: p.title, rentalValue: toNum(p.values[0]?.rental_value), type: p.type?.description, areaTotal: p.area_total, valuePerSqm: p.area_total > 0 ? +(toNum(p.values[0]?.rental_value) / p.area_total).toFixed(2) : 0, owner: p.owner?.name
    }));
    const prevAvgValue = prevProperties.length > 0 ? prevProperties.reduce((acc, p) => acc + toNum(p.values[0]?.rental_value), 0) / prevProperties.length : 0;

    // 2. Valor Total Aluguel
    const activeRentalData = properties.filter(p => toNum(p.values[0]?.rental_value) > 0 && p.values[0]?.status === "AVAILABLE").map(p => ({
      id: p.id, title: p.title, rentalValue: toNum(p.values[0]?.rental_value), status: p.values[0]?.status, type: p.type?.description, agency: p.agency ? { tradeName: p.agency.trade_name } : null, leaseInfo: p.leases[0] ? { contractNumber: p.leases[0].contract_number, tenantName: p.leases[0].tenant?.name } : null
    }));
    const prevTotalRent = prevProperties.reduce((acc, p) => acc + (p.values[0]?.status === "AVAILABLE" ? toNum(p.values[0]?.rental_value) : 0), 0);

    // 3. Impostos e Taxas
    const taxFeeData = properties.filter(p => toNum(p.values[0]?.property_tax) > 0 || toNum(p.values[0]?.condo_fee) > 0).map(p => {
      const total = toNum(p.values[0]?.property_tax) + toNum(p.values[0]?.condo_fee);
      const rent = toNum(p.values[0]?.rental_value);
      return { id: p.id, title: p.title, type: p.type?.description, propertyTax: toNum(p.values[0]?.property_tax), condoFee: toNum(p.values[0]?.condo_fee), totalTaxAndCondo: total, rentalValue: rent, costToRentRatio: rent > 0 ? +((total / rent) * 100).toFixed(2) : 0, impactOnRevenue: rent > 0 ? +((total / rent) * 100).toFixed(2) : 0 };
    });
    const prevTotalTax = prevProperties.reduce((acc, p) => acc + toNum(p.values[0]?.property_tax) + toNum(p.values[0]?.condo_fee), 0);

    // 4. Aquisição
    const acquisitionData = properties.filter(p => toNum(p.values[0]?.purchase_value) > 0).map(p => {
      const purchase = toNum(p.values[0]?.purchase_value);
      const annualRent = toNum(p.values[0]?.rental_value) * 12;
      return { id: p.id, title: p.title, type: p.type?.description, purchaseValue: purchase, currentStatus: p.values[0]?.status, acquisitionDate: p.values[0]?.created_at, saleValue: toNum(p.values[0]?.sale_value), estimatedAnnualROI: purchase > 0 ? +((annualRent / purchase) * 100).toFixed(2) : 0 };
    });
    const prevTotalAcq = prevProperties.reduce((acc, p) => acc + toNum(p.values[0]?.purchase_value), 0);

    // 5. Vacância Financeira
    const finVacancyData = properties.filter(p => p.values[0]?.status === "AVAILABLE").map(p => ({
      id: p.id, title: p.title, rentalValue: toNum(p.values[0]?.rental_value), monthsVacant: this.calculateVacancyMonths(p.leases, endDate), estimatedLoss: toNum(p.values[0]?.rental_value) * this.calculateVacancyMonths(p.leases, endDate)
    }));
    const currentFinVacRate = properties.length > 0 ? (finVacancyData.length / properties.length) * 100 : 0;
    const prevFinVacRate = prevProperties.length > 0 ? (prevProperties.filter(p => p.values[0]?.status === "AVAILABLE").length / prevProperties.length) * 100 : 0;

    // 6. Vacância em Meses
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

    // 1. Total de Imóveis
    const allDetails = properties.map(p => ({ id: p.id, title: p.title, type: p.type?.description, status: p.values[0]?.status, rentalValue: toNum(p.values[0]?.rental_value), areaTotal: p.area_total, documentCount: p.documents.length, agency: p.agency ? { tradeName: p.agency.trade_name } : null }));

    // 2. Documentação Pendente
    const pendingDocs = properties.map(p => {
      const present = p.documents.map(d => d.type);
      const missing = REQUIRED_DOCUMENT_TYPES.filter(t => !present.includes(t as any));
      return { id: p.id, title: p.title, documentCount: p.documents.length, type: p.type?.description, missingDocuments: missing, isComplete: missing.length === 0 };
    }).filter(p => !p.isComplete);
    const prevPendingCount = prevProperties.filter(p => {
      const present = p.documents.map(d => d.type);
      return REQUIRED_DOCUMENT_TYPES.some(t => !present.includes(t as any));
    }).length;

    // 3. Valor de Venda
    const saleValueData = properties.filter(p => toNum(p.values[0]?.sale_value) > 0).map(p => ({ id: p.id, title: p.title, saleValue: toNum(p.values[0]?.sale_value), type: p.type?.description, rentalValue: toNum(p.values[0]?.rental_value) }));

    // 4. Taxas de Ocupação e Vacância
    const available = properties.filter(p => p.values[0]?.status === "AVAILABLE").map(p => ({ id: p.id, title: p.title, type: p.type?.description, rentalValue: toNum(p.values[0]?.rental_value), areaTotal: p.area_total, monthsVacant: this.calculateVacancyMonths(p.leases, endDate) }));
    const occupied = properties.filter(p => p.values[0]?.status !== "AVAILABLE").map(p => ({ id: p.id, title: p.title, type: p.type?.description, rentalValue: toNum(p.values[0]?.rental_value), status: p.values[0]?.status }));
    
    const currentVacRate = properties.length > 0 ? (available.length / properties.length) * 100 : 0;
    const prevVacRate = prevProperties.length > 0 ? (prevProperties.filter(p => p.values[0]?.status === "AVAILABLE").length / prevProperties.length) * 100 : 0;
    
    const currentOccRate = properties.length > 0 ? (occupied.length / properties.length) * 100 : 0;
    const prevOccRate = prevProperties.length > 0 ? (prevProperties.filter(p => p.values[0]?.status !== "AVAILABLE").length / prevProperties.length) * 100 : 0;

    const currentPhysVac = properties.reduce((acc, p) => acc + this.calculateVacancyMonths(p.leases, endDate), 0);
    const prevPhysVac = prevProperties.reduce((acc, p) => acc + this.calculateVacancyMonths(p.leases, periods.previous.end), 0);

    // 5. Imóveis por Tipo (Donut)
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
      // 1. Proprietários com Imóveis Detalhados
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

      // 2. Inquilinos com Contratos e Imóveis
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

      // 3. Agências com Imóveis
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

    // --- Processamento dos Dados ---

    // Detalhes dos Proprietários (incluindo a lista de imóveis)
    const ownersDetails = owners.map(o => ({
      id: o.id,
      name: o.name,
      createdAt: o.created_at,
      propertiesCount: o.properties.length,
      // Retornando o imóvel em si para visualização
      properties: o.properties.map(p => ({
        id: p.id,
        title: p.title,
        type: p.type?.description,
        status: p.values[0]?.status,
        rentalValue: toNum(p.values[0]?.rental_value),
        saleValue: toNum(p.values[0]?.sale_value)
      }))
    }));

    // Detalhes dos Inquilinos (incluindo imóveis relacionados)
    const tenantsDetails = tenants.map(t => ({
      id: t.id,
      name: t.name,
      createdAt: t.created_at,
      // Mapeando imóveis através dos contratos
      properties: t.leases.map(l => ({
        id: l.property.id,
        title: l.property.title,
        type: l.property.type?.description,
        contractNumber: l.contract_number,
        rentalValue: toNum(l.rent_amount)
      }))
    }));

    // Detalhes das Agências
    const agenciesDetails = agencies.map(a => ({
      id: a.id,
      legalName: a.legal_name,
      tradeName: a.trade_name,
      createdAt: a.created_at,
      propertiesCount: a.properties.length
    }));

    // Cálculos de Variação
    const totalProperties = owners.reduce((acc, o) => acc + o.properties.length, 0);
    const propertiesPerOwnerVal = owners.length > 0 ? totalProperties / owners.length : 0;
    
    // Estimativa anterior simplificada
    const prevTotalPropertiesEstimate = prevOwnersCount * propertiesPerOwnerVal; 
    const prevPropertiesPerOwnerVal = prevOwnersCount > 0 ? prevTotalPropertiesEstimate / prevOwnersCount : 0;

    return {
      ownersTotal: calcVariation(owners.length, prevOwnersCount, ownersDetails),
      
      tenantsTotal: calcVariation(tenants.length, prevTenantsCount, tenantsDetails),
      
      propertiesPerOwner: calcVariation(propertiesPerOwnerVal, prevPropertiesPerOwnerVal, ownersDetails), 
      
      agenciesTotal: calcVariation(agencies.length, prevAgenciesCount, agenciesDetails),
      
      // Imóveis por Agência (Donut/Lista)
      propertiesByAgency: agencies.map(a => ({
        name: a.trade_name || a.legal_name,
        value: a.properties.length,
        // Detalhes ricos para o modal/drilldown incluindo a própria agência
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

  static async getGeolocation(startDate: Date, endDate: Date): Promise<GeolocationResponse> {
    const properties = await prisma.property.findMany({
      where: { created_at: { gte: startDate, lte: endDate }, deleted_at: null },
      include: { addresses: { where: { deleted_at: null }, include: { address: true } } }
    });

    const addresses = properties.flatMap(p => p.addresses.map(a => ({ 
      street: a.address.street, number: a.address.number?.toString(), city: a.address.city, state: a.address.state, country: a.address.country, title: p.title 
    })));

    const coordinates = await fetchCoordinatesBatch(addresses, 3);
    return { coordinates };
  }
}