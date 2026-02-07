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
