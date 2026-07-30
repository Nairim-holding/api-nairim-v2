// src/types/dashboard.ts

export interface DashboardParams {
  startDate: string;
  endDate: string;
}

export interface DashboardSection {
  section: 'financial' | 'portfolio' | 'clients' | 'map';
}

export interface MetricResult {
  result: number;
  variation: number;
  isPositive: boolean;
  data: any[];
}

export interface ChartData {
  name: string;
  value: number;
  data: any[];
}

export interface FinancialMetrics {
  averageRentalTicket: MetricResult;
  totalRentalActive: MetricResult;
  totalAcquisitionValue: MetricResult;
  financialVacancyRate: MetricResult;
  totalPropertyTaxAndCondoFee: MetricResult;
  vacancyInMonths: MetricResult;
}

export interface PortfolioMetrics {
  totalPropertys: MetricResult;
  countPropertiesWithLessThan3Docs: MetricResult;
  totalPropertiesWithSaleValue?: MetricResult; 
  availablePropertiesByType: ChartData[];
  vacancyRate: MetricResult;    // Atualizado de number para MetricResult para suportar detalhes
  occupationRate: MetricResult; // Atualizado de number para MetricResult para suportar detalhes
  physicalVacancy: MetricResult; // Atualizado de number para MetricResult para suportar detalhes
}

export interface ClientsMetrics {
  ownersTotal: MetricResult;
  tenantsTotal: MetricResult;
  propertiesPerOwner: MetricResult;
  agenciesTotal: MetricResult;
  propertiesByAgency: ChartData[];
}

/** Faixas de tempo de permanência do inquilino em um imóvel (limite inferior fechado, superior aberto). */
export type TenantTenureBucketKey = 'UP_TO_1' | 'Y1_TO_2' | 'Y2_TO_3' | 'Y3_TO_4' | 'Y4_TO_5' | 'OVER_5';

export interface TenantTenureBucket {
  key: TenantTenureBucketKey;
  /** Rótulo completo, usado no tooltip e no grid detalhado. */
  label: string;
  /** Rótulo curto para o eixo X (os completos não caberiam em 6 categorias). */
  shortLabel: string;
  count: number;
}

/** Uma linha do "Ver Dados Detalhados": uma locação = uma linha. */
export interface TenantTenureLease {
  id: string;
  tenantName: string;
  propertyTitle: string;
  contractNumber: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** Fim EFETIVO (canceled_at p/ canceladas, end_date p/ encerradas, hoje p/ em curso). YYYY-MM-DD */
  endDate: string;
  situation: 'Em curso' | 'Encerrada' | 'Cancelada';
  /** Tempo de permanência em anos, 2 casas decimais. */
  years: number;
  bucketKey: TenantTenureBucketKey;
  bucketLabel: string;
}

export interface TenantTenureDistribution {
  /** Sempre as 6 faixas, mesmo com count 0, para o eixo do gráfico não "pular" faixas. */
  buckets: TenantTenureBucket[];
  leases: TenantTenureLease[];
  /** Invariante: total === leases.length === soma dos buckets[].count */
  total: number;
}

export interface GeolocationPoint {
  lat: number;
  lng: number;
  info: string;
}

export interface GeolocationResponse {
  coordinates: GeolocationPoint[];
}

export interface PeriodComparison {
  current: {
    start: Date;
    end: Date;
  };
  previous: {
    start: Date;
    end: Date;
  };
}
