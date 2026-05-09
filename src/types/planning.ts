export interface MonthlyData {
  month: number;
  year: number;
  realized_amount: number;
}

export interface DashboardItem {
  id: string;
  name: string;
  planned_amount: number;
  realized_amount: number;
  percentage: number;
  min: number | null;
  med: number;
  max: number | null;
  monthly_data: MonthlyData[];
}

export interface CategoryDashboard extends DashboardItem {
  type: 'INCOME' | 'EXPENSE';
  subcategories: DashboardItem[];
}

export interface DashboardResponse {
  start_date: string;
  end_date: string;
  balances: {
    monthly: MonthlyData[];
    accumulated: MonthlyData[];
  };
  incomes: CategoryDashboard[];
  expenses: CategoryDashboard[];
}
