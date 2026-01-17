export interface DashboardParams {
  startDate: string;
  endDate: string;
}

export interface DashboardSection {
  section: 'financial' | 'portfolio' | 'clients' | 'map';
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
  totalPropertiesWithSaleValue?: MetricResult; // Opcional pois não existe no schema
  availablePropertiesByType: ChartData[];
  vacancyRate: number;
  occupationRate: number;
  physicalVacancy: number;
}

export interface ClientsMetrics {
  ownersTotal: MetricResult;
  tenantsTotal: MetricResult;
  propertiesPerOwner: MetricResult;
  agenciesTotal: MetricResult;
  propertiesByAgency: ChartData[];
}

export interface GeolocationResponse {
  coordinates: GeolocationPoint[];
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

export interface GeolocationPoint {
  lat: number;
  lng: number;
  info: string;
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