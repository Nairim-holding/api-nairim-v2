// src/services/DashboardService.ts
import { Decimal } from '@prisma/client/runtime/client';
import prisma from '../lib/prisma';
import { 
  PeriodComparison, 
  FinancialMetrics, 
  PortfolioMetrics, 
  ClientsMetrics, 
  GeolocationResponse 
} from '../types/dashboard';

const decimalToNumber = (v: Decimal | number | null | undefined) =>
  v == null ? 0 : v instanceof Decimal ? v.toNumber() : Number(v);

const calcVariation = (current: number, previous: number, data?: any[]) => {
  if (previous === 0 || !isFinite(previous)) {
    return { 
      result: +current.toFixed(2), 
      variation: 0, 
      isPositive: current >= 0,
      data: data || []
    };
  }
  let variation = ((current - previous) / previous) * 100;
  variation = Math.max(Math.min(variation, 60), -60);
  return {
    result: +current.toFixed(2),
    variation: +variation.toFixed(2),
    isPositive: variation >= 0,
    data: data || []
  };
};

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
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      fullAddress
    )}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "MeuSistemaImobiliario/1.0 (https://seudominio.com)",
          "Accept-Language": "pt-BR",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.warn("⚠️ Falha ao buscar coordenadas:", res.status, res.statusText);
        return;
      }

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn("⚠️ Resposta inválida (HTML retornado pelo Nominatim)");
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        results.push({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          info: `${addr.title} (${addr.city}/${addr.state})`,
        });
      } else {
        console.warn("⚠️ Nenhum resultado de coordenadas:", fullAddress);
      }
    } catch (err) {
      console.error("❌ Erro coordenadas:", err);
      await delay(1000);
      return worker(addr);
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
    const prevStartDate = new Date(startDate.getTime() - diffMs - 1);
    const prevEndDate = new Date(startDate.getTime() - 1);
    
    return {
      current: { start: startDate, end: endDate },
      previous: { start: prevStartDate, end: prevEndDate }
    };
  }

  static async getFinancialMetrics(startDate: Date, endDate: Date): Promise<FinancialMetrics> {
    try {
      console.log('💰 Getting financial metrics...');
      
      const periods = this.getPeriodDates(startDate, endDate);

      const [properties, prevProperties] = await Promise.all([
        prisma.property.findMany({
          where: { 
            created_at: { gte: periods.current.start, lte: periods.current.end },
            deleted_at: null
          },
          include: {
            type: true,
            values: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' },
              take: 1
            },
            agency: {
              select: {
                id: true,
                trade_name: true
              }
            }
          },
        }),
        prisma.property.findMany({
          where: { 
            created_at: { gte: periods.previous.start, lte: periods.previous.end },
            deleted_at: null
          },
          include: {
            type: true,
            values: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' },
              take: 1
            }
          },
        })
      ]);

      const toNum = (v: any) => decimalToNumber(v);

      // Processar dados financeiros
      const rentalActiveProperties = properties
        .filter((p) => toNum(p.values[0]?.rental_value) > 0 && p.values[0]?.status === "AVAILABLE")
        .map((p) => ({
          id: p.id,
          title: p.title,
          rentalValue: toNum(p.values[0]?.rental_value),
          status: p.values[0]?.status,
          type: p.type?.description || "Desconhecido",
          agency: p.agency ? {
            id: p.agency.id,
            tradeName: p.agency.trade_name,
          } : null,
        }));

      const prevRentalActiveProperties = prevProperties
        .filter((p) => toNum(p.values[0]?.rental_value) > 0 && p.values[0]?.status === "AVAILABLE")
        .map((p) => ({
          id: p.id,
          title: p.title,
          rentalValue: toNum(p.values[0]?.rental_value),
        }));

      const propertiesWithAcquisitionValue = properties
        .filter((p) => toNum(p.values[0]?.purchase_value) > 0)
        .map((p) => ({
          id: p.id,
          title: p.title,
          purchaseValue: toNum(p.values[0]?.purchase_value),
          type: p.type?.description || "Desconhecido",
          currentStatus: p.values[0]?.status,
        }));

      const prevPropertiesWithAcquisitionValue = prevProperties
        .filter((p) => toNum(p.values[0]?.purchase_value) > 0)
        .map((p) => ({
          id: p.id,
          title: p.title,
          purchaseValue: toNum(p.values[0]?.purchase_value),
        }));

      const propertiesWithTaxAndCondo = properties
        .filter((p) => toNum(p.values[0]?.property_tax) > 0 || toNum(p.values[0]?.condo_fee) > 0)
        .map((p) => ({
          id: p.id,
          title: p.title,
          propertyTax: toNum(p.values[0]?.property_tax),
          condoFee: toNum(p.values[0]?.condo_fee),
          totalTaxAndCondo: toNum(p.values[0]?.property_tax) + toNum(p.values[0]?.condo_fee),
          type: p.type?.description || "Desconhecido",
        }));

      const prevPropertiesWithTaxAndCondo = prevProperties
        .filter((p) => toNum(p.values[0]?.property_tax) > 0 || toNum(p.values[0]?.condo_fee) > 0)
        .map((p) => ({
          id: p.id,
          title: p.title,
          propertyTax: toNum(p.values[0]?.property_tax),
          condoFee: toNum(p.values[0]?.condo_fee),
        }));

      const propertiesWithRentPotential = properties
        .filter((p) => p.values[0]?.status === "AVAILABLE" && toNum(p.values[0]?.rental_value) > 0)
        .map((p) => ({
          id: p.id,
          title: p.title,
          rentalValue: toNum(p.values[0]?.rental_value),
          type: p.type?.description || "Desconhecido",
          areaTotal: p.area_total,
        }));

      const prevPropertiesWithRentPotential = prevProperties
        .filter((p) => p.values[0]?.status === "AVAILABLE" && toNum(p.values[0]?.rental_value) > 0)
        .map((p) => ({
          id: p.id,
          title: p.title,
          rentalValue: toNum(p.values[0]?.rental_value),
        }));

      // Cálculos específicos financeiros
      const rentals = properties.flatMap((p) => p.values.map((v) => toNum(v.rental_value)) || []);
      const prevRentals = prevProperties.flatMap((p) => p.values.map((v) => toNum(v.rental_value)) || []);
      const avgRental = rentals.length > 0 ? rentals.reduce((a, b) => a + b, 0) / rentals.length : 0;
      const prevAvgRental = prevRentals.length > 0 ? prevRentals.reduce((a, b) => a + b, 0) / prevRentals.length : 0;

      const averageRentalTicket = calcVariation(avgRental, prevAvgRental, 
        properties.map(p => ({
          id: p.id,
          title: p.title,
          rentalValue: toNum(p.values[0]?.rental_value),
          type: p.type?.description || "Desconhecido",
        }))
      );

      const totalRentalActive = calcVariation(
        properties.reduce((a, p) => a + toNum(p.values[0]?.rental_value), 0),
        prevProperties.reduce((a, p) => a + toNum(p.values[0]?.rental_value), 0),
        rentalActiveProperties
      );

      const totalAcquisitionValue = calcVariation(
        properties.reduce((a, p) => a + toNum(p.values[0]?.purchase_value), 0),
        prevProperties.reduce((a, p) => a + toNum(p.values[0]?.purchase_value), 0),
        propertiesWithAcquisitionValue
      );

      const totalPropertyTaxAndCondoFee = calcVariation(
        properties.reduce(
          (a, p) =>
            a + toNum(p.values[0]?.property_tax) + toNum(p.values[0]?.condo_fee),
          0
        ),
        prevProperties.reduce(
          (a, p) =>
            a + toNum(p.values[0]?.property_tax) + toNum(p.values[0]?.condo_fee),
          0
        ),
        propertiesWithTaxAndCondo
      );

      const totalPotentialRentUnoccupied = properties.reduce(
        (a, p) =>
          a + (p.values[0]?.status === "AVAILABLE" ? toNum(p.values[0]?.rental_value) : 0),
        0
      );

      const prevTotalPotentialRentUnoccupied = prevProperties.reduce(
        (a, p) =>
          a + (p.values[0]?.status === "AVAILABLE" ? toNum(p.values[0]?.rental_value) : 0),
        0
      );

      const vacancyInMonths = calcVariation(
        avgRental ? totalPotentialRentUnoccupied / avgRental : 0,
        avgRental ? prevTotalPotentialRentUnoccupied / avgRental : 0,
        propertiesWithRentPotential
      );

      const financialVacancyRate = calcVariation(
        totalRentalActive.result
          ? (totalPotentialRentUnoccupied / totalRentalActive.result) * 100
          : 0,
        totalRentalActive.result
          ? (prevTotalPotentialRentUnoccupied / totalRentalActive.result) * 100
          : 0,
        propertiesWithRentPotential
      );

      console.log('✅ Financial metrics calculated successfully');

      return {
        averageRentalTicket,
        totalRentalActive,
        totalAcquisitionValue,
        financialVacancyRate,
        totalPropertyTaxAndCondoFee,
        vacancyInMonths,
      };

    } catch (error: any) {
      console.error('❌ Error in DashboardService.getFinancialMetrics:', error);
      throw new Error('Failed to fetch financial metrics');
    }
  }

  static async getPortfolioMetrics(startDate: Date, endDate: Date): Promise<PortfolioMetrics> {
    try {
      console.log('📊 Getting portfolio metrics...');
      
      const periods = this.getPeriodDates(startDate, endDate);

      const [properties, prevProperties] = await Promise.all([
        prisma.property.findMany({
          where: { 
            created_at: { gte: periods.current.start, lte: periods.current.end },
            deleted_at: null
          },
          include: {
            type: true,
            values: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' },
              take: 1
            },
            documents: {
              where: { deleted_at: null }
            },
            agency: {
              select: {
                id: true,
                trade_name: true
              }
            }
          },
        }),
        prisma.property.findMany({
          where: { 
            created_at: { gte: periods.previous.start, lte: periods.previous.end },
            deleted_at: null
          },
          include: {
            type: true,
            values: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' },
              take: 1
            },
            documents: {
              where: { deleted_at: null }
            }
          },
        })
      ]);

      const toNum = (v: any) => decimalToNumber(v);

      // Processar dados do portfólio
      const propertiesWithLessThan3Docs = properties
        .filter((p) => p.documents.length < 3)
        .map((p) => ({
          id: p.id,
          title: p.title,
          documentCount: p.documents.length,
          documents: p.documents.map(d => ({ 
            file_type: d.file_type,
            type: d.type 
          })),
          type: p.type?.description || "Desconhecido",
        }));

      const prevPropertiesWithLessThan3Docs = prevProperties
        .filter((p) => p.documents.length < 3)
        .map((p) => ({
          id: p.id,
          title: p.title,
          documentCount: p.documents.length,
        }));

      const availableProperties = properties
        .filter((p) => p.values[0]?.status === "AVAILABLE")
        .map((p) => ({
          id: p.id,
          title: p.title,
          type: p.type?.description || "Desconhecido",
          rentalValue: toNum(p.values[0]?.rental_value),
          areaTotal: p.area_total,
          agency: p.agency ? {
            id: p.agency.id,
            tradeName: p.agency.trade_name,
          } : null,
        }));

      const allPropertiesDetails = properties.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type?.description || "Desconhecido",
        status: p.values[0]?.status,
        rentalValue: toNum(p.values[0]?.rental_value),
        areaTotal: p.area_total,
        documentCount: p.documents.length,
        agency: p.agency ? {
          id: p.agency.id,
          tradeName: p.agency.trade_name,
        } : null,
      }));

      const prevAllPropertiesDetails = prevProperties.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type?.description || "Desconhecido",
        status: p.values[0]?.status,
      }));

      // Cálculos do portfólio
      const totalProperties = calcVariation(
        properties.length, 
        prevProperties.length,
        allPropertiesDetails
      );

      const countPropertiesWithLessThan3Docs = calcVariation(
        propertiesWithLessThan3Docs.length,
        prevPropertiesWithLessThan3Docs.length,
        propertiesWithLessThan3Docs
      );

      const availablePropertiesByType = Object.entries(
        properties.reduce((acc: Record<string, number>, p) => {
          const isAvailable = p.values[0]?.status === "AVAILABLE";
          const type = p.type?.description || "Desconhecido";
          if (isAvailable) acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ 
        name, 
        value,
        data: availableProperties.filter(p => p.type === name)
      }));

      // Calcular taxas de vacância
      const rentals = properties.flatMap((p) => p.values.map((v) => toNum(v.rental_value)) || []);
      const avgRental = rentals.length > 0 ? rentals.reduce((a, b) => a + b, 0) / rentals.length : 0;
      const totalPotentialRentUnoccupied = properties.reduce(
        (a, p) =>
          a + (p.values[0]?.status === "AVAILABLE" ? toNum(p.values[0]?.rental_value) : 0),
        0
      );
      const totalRentalActive = properties.reduce((a, p) => a + toNum(p.values[0]?.rental_value), 0);

      const financialVacancyRate = totalRentalActive
        ? (totalPotentialRentUnoccupied / totalRentalActive) * 100
        : 0;

      const vacancyInMonths = avgRental ? totalPotentialRentUnoccupied / avgRental : 0;

      console.log('✅ Portfolio metrics calculated successfully');

      return {
        totalPropertys: totalProperties,
        countPropertiesWithLessThan3Docs,
        totalPropertiesWithSaleValue: {
          result: 0,
          variation: 0,
          isPositive: false,
          data: []
        },
        availablePropertiesByType,
        vacancyRate: financialVacancyRate,
        occupationRate: 100 - financialVacancyRate,
        physicalVacancy: vacancyInMonths
      };

    } catch (error: any) {
      console.error('❌ Error in DashboardService.getPortfolioMetrics:', error);
      throw new Error('Failed to fetch portfolio metrics');
    }
  }

  static async getClientsMetrics(startDate: Date, endDate: Date): Promise<ClientsMetrics> {
    try {
      console.log('👥 Getting clients metrics...');
      
      const periods = this.getPeriodDates(startDate, endDate);

      const [
        owners,
        prevOwners,
        tenants,
        prevTenants,
        agencies,
        prevAgencies,
        properties
      ] = await Promise.all([
        prisma.owner.findMany({ 
          where: { 
            created_at: { gte: periods.current.start, lte: periods.current.end },
            deleted_at: null
          }, 
          select: { 
            id: true, 
            name: true, 
            created_at: true,
            properties: {
              where: { deleted_at: null },
              select: { id: true }
            }
          } 
        }),
        prisma.owner.findMany({ 
          where: { 
            created_at: { gte: periods.previous.start, lte: periods.previous.end },
            deleted_at: null
          }, 
          select: { id: true } 
        }),
        prisma.tenant.findMany({ 
          where: { 
            created_at: { gte: periods.current.start, lte: periods.current.end },
            deleted_at: null
          }, 
          select: { 
            id: true, 
            name: true, 
            created_at: true 
          } 
        }),
        prisma.tenant.findMany({ 
          where: { 
            created_at: { gte: periods.previous.start, lte: periods.previous.end },
            deleted_at: null
          }, 
          select: { id: true } 
        }),
        prisma.agency.findMany({
          where: { 
            created_at: { gte: periods.current.start, lte: periods.current.end },
            deleted_at: null
          },
          select: { 
            id: true, 
            legal_name: true, 
            trade_name: true, 
            created_at: true,
            properties: {
              where: { deleted_at: null },
              select: { id: true }
            }
          },
        }),
        prisma.agency.findMany({
          where: { 
            created_at: { gte: periods.previous.start, lte: periods.previous.end },
            deleted_at: null
          },
          select: { id: true },
        }),
        prisma.property.findMany({
          where: { 
            created_at: { gte: periods.current.start, lte: periods.current.end },
            deleted_at: null
          },
          select: {
            id: true,
            title: true,
            agency_id: true
          }
        })
      ]);

      // Processar dados de clientes
      const ownersDetails = owners.map((owner) => ({
        id: owner.id,
        name: owner.name,
        createdAt: owner.created_at,
        propertiesCount: owner.properties.length
      }));

      const tenantsDetails = tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        createdAt: tenant.created_at,
      }));

      const agenciesDetails = agencies.map((agency) => ({
        id: agency.id,
        legalName: agency.legal_name,
        tradeName: agency.trade_name,
        createdAt: agency.created_at,
        propertiesCount: agency.properties.length
      }));

      // Cálculos de clientes
      const ownersTotal = calcVariation(
        owners.length, 
        prevOwners.length,
        ownersDetails
      );

      const tenantsTotal = calcVariation(
        tenants.length, 
        prevTenants.length,
        tenantsDetails
      );

      const propertiesPerOwnerValue = owners.length > 0 
        ? properties.length / owners.length 
        : 0;
      const prevPropertiesPerOwnerValue = prevOwners.length > 0 
        ? properties.length / prevOwners.length 
        : 0;

      const propertiesPerOwner = calcVariation(
        propertiesPerOwnerValue,
        prevPropertiesPerOwnerValue,
        ownersDetails
      );

      const agenciesTotal = calcVariation(
        agencies.length, 
        prevAgencies.length,
        agenciesDetails
      );

      const propertiesByAgency = agencies.map((agency) => {
        const agencyProperties = properties.filter((p) => p.agency_id === agency.id);
        return {
          name: agency.trade_name || agency.legal_name || `Agência ${agency.id}`,
          value: agencyProperties.length,
          data: agencyProperties.map(p => ({
            id: p.id,
            title: p.title
          }))
        };
      });

      console.log('✅ Clients metrics calculated successfully');

      return {
        ownersTotal,
        tenantsTotal,
        propertiesPerOwner,
        agenciesTotal,
        propertiesByAgency
      };

    } catch (error: any) {
      console.error('❌ Error in DashboardService.getClientsMetrics:', error);
      throw new Error('Failed to fetch clients metrics');
    }
  }

  static async getGeolocation(startDate: Date, endDate: Date): Promise<GeolocationResponse> {
    try {
      console.log('🗺️ Getting geolocation data...');

      const properties = await prisma.property.findMany({
        where: { 
          created_at: { gte: startDate, lte: endDate },
          deleted_at: null
        },
        include: {
          addresses: {
            where: { deleted_at: null },
            include: {
              address: true
            }
          },
        },
      });

      const flattenedAddresses = properties.flatMap((p) =>
        p.addresses.map((a) => ({ 
          ...a.address, 
          number: a.address.number?.toString(), 
          title: p.title 
        }))
      );

      const coordinates = await fetchCoordinatesBatch(flattenedAddresses, 3);

      console.log(`✅ Found ${coordinates.length} coordinates`);
      return { coordinates };

    } catch (error: any) {
      console.error('❌ Error in DashboardService.getGeolocation:', error);
      throw new Error('Failed to fetch geolocation data');
    }
  }
}