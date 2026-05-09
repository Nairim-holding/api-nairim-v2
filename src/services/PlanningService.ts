import prisma from '@/lib/prisma';
import { DashboardResponse, MonthlyData, DashboardItem, CategoryDashboard } from '@/types/planning';

interface MonthlyValueInput {
  month: number;
  amount: number;
}

interface UpsertPlanningInput {
  category_id: string;
  subcategory_id?: string | null;
  year: number;
  type: 'FIXED' | 'VARIABLE';
  default_amount?: number | null;
  min_recommended?: number | null;
  max_recommended?: number | null;
  monthly_values?: MonthlyValueInput[];
}

export class PlanningService {
  static async upsertPlanning(data: UpsertPlanningInput) {
    try {
      const existing = await prisma.planning.findFirst({
        where: {
          category_id: data.category_id,
          subcategory_id: data.subcategory_id ?? null,
          year: Number(data.year),
          deleted_at: null,
        },
      });

      const planningData = {
        category_id: data.category_id,
        subcategory_id: data.subcategory_id ?? null,
        year: Number(data.year),
        type: data.type,
        default_amount: data.default_amount != null ? Number(data.default_amount) : null,
        min_recommended: data.min_recommended != null ? Number(data.min_recommended) : null,
        max_recommended: data.max_recommended != null ? Number(data.max_recommended) : null,
        is_active: true,
      };

      let planning;

      if (existing) {
        planning = await prisma.planning.update({
          where: { id: existing.id },
          data: planningData,
        });
        await prisma.planningMonth.deleteMany({ where: { planning_id: existing.id } });
      } else {
        planning = await prisma.planning.create({ data: planningData });
      }

      if (data.type === 'FIXED') {
        const amount = Number(data.default_amount ?? 0);
        await prisma.planningMonth.createMany({
          data: Array.from({ length: 12 }, (_, i) => ({
            planning_id: planning.id,
            month: i + 1,
            amount,
          })),
        });
      } else {
        const monthlyValues = data.monthly_values ?? [];
        await prisma.planningMonth.createMany({
          data: monthlyValues.map((mv) => ({
            planning_id: planning.id,
            month: Number(mv.month),
            amount: Number(mv.amount),
          })),
        });
      }

      return await prisma.planning.findUnique({
        where: { id: planning.id },
        include: { monthly_values: { orderBy: { month: 'asc' } } },
      });
    } catch (error: any) {
      throw error;
    }
  }

  static async getPlannings(year: number) {
    try {
      const [categories, plannings] = await Promise.all([
        prisma.category.findMany({
          where: { deleted_at: null, is_active: true },
          include: {
            subcategories: {
              where: { deleted_at: null, is_active: true },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: [{ type: 'asc' }, { name: 'asc' }],
        }),
        prisma.planning.findMany({
          where: { year: Number(year), deleted_at: null },
          include: { monthly_values: { orderBy: { month: 'asc' } } },
        }),
      ]);

      const planningMap = new Map<string, (typeof plannings)[0]>();
      for (const p of plannings) {
        const key = `${p.category_id}::${p.subcategory_id ?? ''}`;
        planningMap.set(key, p);
      }

      return categories.map((cat) => {
        const catKey = `${cat.id}::`;
        const catPlanning = planningMap.get(catKey) ?? null;

        const subcategories = cat.subcategories.map((sub) => {
          const subKey = `${cat.id}::${sub.id}`;
          const subPlanning = planningMap.get(subKey) ?? null;
          return { ...sub, planning: subPlanning };
        });

        return { ...cat, planning: catPlanning, subcategories };
      });
    } catch (error: any) {
      throw error;
    }
  }

  static async getPlanningById(id: string) {
    try {
      const planning = await prisma.planning.findUnique({
        where: { id, deleted_at: null },
        include: {
          category: true,
          subcategory: true,
          monthly_values: { orderBy: { month: 'asc' } },
        },
      });
      if (!planning) throw new Error('Planning not found');
      return planning;
    } catch (error: any) {
      throw error;
    }
  }

  static async deletePlanning(id: string) {
    try {
      const planning = await prisma.planning.findUnique({ where: { id, deleted_at: null } });
      if (!planning) throw new Error('Planning not found');

      return await prisma.planning.update({
        where: { id },
        data: { deleted_at: new Date() },
      });
    } catch (error: any) {
      throw error;
    }
  }

  static async getPlanningDashboard(
    startDate: string,
    endDate: string,
  ): Promise<DashboardResponse> {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      // Gera lista de meses no período
      const months: { month: number; year: number }[] = [];
      const current = new Date(start);
      while (current <= end) {
        months.push({ month: current.getMonth() + 1, year: current.getFullYear() });
        current.setMonth(current.getMonth() + 1);
      }

      // Busca categorias ativas com subcategorias
      const categories = await prisma.category.findMany({
        where: { deleted_at: null, is_active: true },
        include: {
          subcategories: { where: { deleted_at: null, is_active: true }, orderBy: { name: 'asc' } },
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });

      // Busca planejamentos dos anos envolvidos
      const yearsInPeriod = [...new Set(months.map((m) => m.year))];
      const plannings = await prisma.planning.findMany({
        where: {
          year: { in: yearsInPeriod },
          deleted_at: null,
        },
        include: { monthly_values: { orderBy: { month: 'asc' } } },
      });

      // Indexa planejamentos
      const planningMap = new Map<string, (typeof plannings)[0]>();
      for (const p of plannings) {
        const key = `${p.category_id}::${p.subcategory_id ?? ''}`;
        planningMap.set(key, p);
      }

      // Busca transações no período (status COMPLETED apenas)
      const transactions = await prisma.transaction.findMany({
        where: {
          deleted_at: null,
          status: 'COMPLETED',
          effective_date: { gte: start, lte: end },
        },
        select: {
          category_id: true,
          subcategory_id: true,
          amount: true,
          effective_date: true,
          category: { select: { type: true } },
        },
      });

      // Agrupa transações: { categoryId -> { subcategoryId|'TOTAL' -> { monthKey -> amount } } }
      type TxMap = Map<string, number>;
      type SubMap = Map<string, TxMap>;
      type CatMap = Map<string, SubMap>;

      const txByCategory: CatMap = new Map();

      for (const tx of transactions) {
        const catId = tx.category_id;
        const subId = tx.subcategory_id ?? '';
        const monthKey = `${tx.effective_date.getFullYear()}-${String(
          tx.effective_date.getMonth() + 1,
        ).padStart(2, '0')}`;
        const amount = Number(tx.amount);

        if (!txByCategory.has(catId)) txByCategory.set(catId, new Map());
        const subMap = txByCategory.get(catId)!;

        // Subcategoria específica
        if (!subMap.has(subId)) subMap.set(subId, new Map());
        const subTxMap = subMap.get(subId)!;
        subTxMap.set(monthKey, (subTxMap.get(monthKey) ?? 0) + amount);

        // Total da categoria
        if (!subMap.has('TOTAL')) subMap.set('TOTAL', new Map());
        const catTxMap = subMap.get('TOTAL')!;
        catTxMap.set(monthKey, (catTxMap.get(monthKey) ?? 0) + amount);
      }

      // Helper: calcula saldo anterior (antes do startDate)
      const previousBalance = await this.calculatePreviousBalance(start);

      // Calcula saldos mensais e acumulados
      const monthlyBalances: MonthlyData[] = [];
      const accumulatedBalances: MonthlyData[] = [];
      let accumulated = previousBalance;

      for (const { month, year } of months) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        let monthIncome = 0;
        let monthExpense = 0;

        for (const [catId, subMap] of txByCategory) {
          const category = categories.find((c) => c.id === catId);
          const catTotal = subMap.get('TOTAL')?.get(monthKey) ?? 0;

          if (category?.type === 'INCOME') {
            monthIncome += catTotal;
          } else {
            monthExpense += catTotal;
          }
        }

        const monthBalance = monthIncome - monthExpense;
        accumulated += monthBalance;

        monthlyBalances.push({
          month,
          year,
          realized_amount: Math.round(monthBalance * 100) / 100,
        });

        accumulatedBalances.push({
          month,
          year,
          realized_amount: Math.round(accumulated * 100) / 100,
        });
      }

      // Builder de DashboardItem
      const buildItem = (
        id: string,
        name: string,
        categoryId: string,
        subcategoryId: string | null,
        monthKeys: string[],
        txMap: TxMap | undefined,
        planningData: (typeof plannings)[0] | undefined,
      ): DashboardItem => {
        const monthlyRealized = monthKeys.map((mk) => ({
          month: parseInt(mk.split('-')[1]),
          year: parseInt(mk.split('-')[0]),
          realized_amount: Math.round((txMap?.get(mk) ?? 0) * 100) / 100,
        }));

        const realizedTotal = monthlyRealized.reduce((s, m) => s + m.realized_amount, 0);

        // Calcula planejado do período
        let plannedTotal = 0;
        if (planningData) {
          for (const monthData of monthlyRealized) {
            const monthIndex = monthData.month;
            const monthValue = planningData.monthly_values.find((mv) => mv.month === monthIndex);
            if (monthValue) plannedTotal += Number(monthValue.amount);
          }
        }

        const percentage =
          plannedTotal > 0 ? Math.round((realizedTotal / plannedTotal) * 10000) / 100 : 0;

        const nonZeroMonths = monthlyRealized.filter((m) => m.realized_amount > 0);
        const average =
          nonZeroMonths.length > 0
            ? Math.round(
                (nonZeroMonths.reduce((s, m) => s + m.realized_amount, 0) /
                  nonZeroMonths.length) *
                  100,
              ) / 100
            : 0;

        return {
          id,
          name,
          planned_amount: Math.round(plannedTotal * 100) / 100,
          realized_amount: Math.round(realizedTotal * 100) / 100,
          percentage,
          min: planningData?.min_recommended ? Number(planningData.min_recommended) : null,
          med: average,
          max: planningData?.max_recommended ? Number(planningData.max_recommended) : null,
          monthly_data: monthlyRealized,
        };
      };

      // Gera month keys para buscar nos maps
      const monthKeys = months.map(
        (m) => `${m.year}-${String(m.month).padStart(2, '0')}`,
      );

      // Processa categorias
      const incomes: CategoryDashboard[] = [];
      const expenses: CategoryDashboard[] = [];

      for (const cat of categories) {
        const catSubMap = txByCategory.get(cat.id);
        const catTxMap = catSubMap?.get('TOTAL');
        const catPlanningKey = `${cat.id}::`;
        const catPlanning = planningMap.get(catPlanningKey);

        const subcategoryItems: DashboardItem[] = [];

        for (const sub of cat.subcategories) {
          const subTxMap = catSubMap?.get(sub.id);
          const subPlanningKey = `${cat.id}::${sub.id}`;
          const subPlanning = planningMap.get(subPlanningKey);

          const subItem = buildItem(
            sub.id,
            sub.name,
            cat.id,
            sub.id,
            monthKeys,
            subTxMap,
            subPlanning,
          );

          subcategoryItems.push(subItem);
        }

        let catPlannedTotal = 0;
        let catRealizedTotal = 0;
        let catMinTotal = 0;
        let catMaxTotal = 0;
        let catMedTotal = 0;
        const catMonthlyData: MonthlyData[] = months.map(({ month, year }) => ({
          month,
          year,
          realized_amount: 0,
        }));

        for (const subItem of subcategoryItems) {
          catPlannedTotal += subItem.planned_amount;
          catRealizedTotal += subItem.realized_amount;
          catMinTotal += subItem.min ?? 0;
          catMaxTotal += subItem.max ?? 0;
          catMedTotal += subItem.med;

          for (const monthData of subItem.monthly_data) {
            const idx = catMonthlyData.findIndex(
              (m) => m.month === monthData.month && m.year === monthData.year,
            );
            if (idx !== -1) {
              catMonthlyData[idx].realized_amount += monthData.realized_amount;
            }
          }
        }

        catMonthlyData.forEach((m) => {
          m.realized_amount = Math.round(m.realized_amount * 100) / 100;
        });

        const catPercentage =
          catPlannedTotal > 0 ? Math.round((catRealizedTotal / catPlannedTotal) * 10000) / 100 : 0;

        const nonZeroMonths = catMonthlyData.filter((m) => m.realized_amount > 0);
        const catAverage =
          nonZeroMonths.length > 0
            ? Math.round(
                (nonZeroMonths.reduce((s, m) => s + m.realized_amount, 0) /
                  nonZeroMonths.length) *
                  100,
              ) / 100
            : 0;

        const catDashboard: CategoryDashboard = {
          id: cat.id,
          name: cat.name,
          type: cat.type as 'INCOME' | 'EXPENSE',
          planned_amount: Math.round(catPlannedTotal * 100) / 100,
          realized_amount: Math.round(catRealizedTotal * 100) / 100,
          percentage: catPercentage,
          min: subcategoryItems.length > 0 ? Math.round(catMinTotal * 100) / 100 : 0,
          med: Math.round(catAverage * 100) / 100,
          max: subcategoryItems.length > 0 ? Math.round(catMaxTotal * 100) / 100 : 0,
          monthly_data: catMonthlyData,
          subcategories: subcategoryItems,
        };

        if (cat.type === 'INCOME') {
          incomes.push(catDashboard);
        } else {
          expenses.push(catDashboard);
        }
      }

      const incomesTotalMin = incomes.reduce((s, cat) => s + (cat.min ?? 0), 0);
      const incomesTotalMed = incomes.reduce((s, cat) => s + cat.med, 0);
      const incomesTotalMax = incomes.reduce((s, cat) => s + (cat.max ?? 0), 0);
      const incomesTotalPlanned = incomes.reduce((s, cat) => s + cat.planned_amount, 0);
      const incomesTotalRealized = incomes.reduce((s, cat) => s + cat.realized_amount, 0);
      const incomesTotalPercentage =
        incomesTotalPlanned > 0
          ? Math.round((incomesTotalRealized / incomesTotalPlanned) * 10000) / 100
          : 0;

      const incomesGlobalMonthly: MonthlyData[] = months.map(({ month, year }) => {
        let amount = 0;
        for (const cat of incomes) {
          const monthData = cat.monthly_data.find((m) => m.month === month && m.year === year);
          if (monthData) amount += monthData.realized_amount;
        }
        return { month, year, realized_amount: Math.round(amount * 100) / 100 };
      });

      const incomeGlobalItem: CategoryDashboard = {
        id: 'incomes-global',
        name: 'Total de Receitas',
        type: 'INCOME',
        planned_amount: Math.round(incomesTotalPlanned * 100) / 100,
        realized_amount: Math.round(incomesTotalRealized * 100) / 100,
        percentage: incomesTotalPercentage,
        min: Math.round(incomesTotalMin * 100) / 100,
        med: Math.round(incomesTotalMed * 100) / 100,
        max: Math.round(incomesTotalMax * 100) / 100,
        monthly_data: incomesGlobalMonthly,
        subcategories: [],
      };

      const expensesTotalMin = expenses.reduce((s, cat) => s + (cat.min ?? 0), 0);
      const expensesTotalMed = expenses.reduce((s, cat) => s + cat.med, 0);
      const expensesTotalMax = expenses.reduce((s, cat) => s + (cat.max ?? 0), 0);
      const expensesTotalPlanned = expenses.reduce((s, cat) => s + cat.planned_amount, 0);
      const expensesTotalRealized = expenses.reduce((s, cat) => s + cat.realized_amount, 0);
      const expensesTotalPercentage =
        expensesTotalPlanned > 0
          ? Math.round((expensesTotalRealized / expensesTotalPlanned) * 10000) / 100
          : 0;

      const expensesGlobalMonthly: MonthlyData[] = months.map(({ month, year }) => {
        let amount = 0;
        for (const cat of expenses) {
          const monthData = cat.monthly_data.find((m) => m.month === month && m.year === year);
          if (monthData) amount += monthData.realized_amount;
        }
        return { month, year, realized_amount: Math.round(amount * 100) / 100 };
      });

      const expenseGlobalItem: CategoryDashboard = {
        id: 'expenses-global',
        name: 'Total de Despesas',
        type: 'EXPENSE',
        planned_amount: Math.round(expensesTotalPlanned * 100) / 100,
        realized_amount: Math.round(expensesTotalRealized * 100) / 100,
        percentage: expensesTotalPercentage,
        min: Math.round(expensesTotalMin * 100) / 100,
        med: Math.round(expensesTotalMed * 100) / 100,
        max: Math.round(expensesTotalMax * 100) / 100,
        monthly_data: expensesGlobalMonthly,
        subcategories: [],
      };

      return {
        start_date: startDate,
        end_date: endDate,
        balances: {
          monthly: monthlyBalances,
          accumulated: accumulatedBalances,
        },
        incomes: [incomeGlobalItem, ...incomes],
        expenses: [expenseGlobalItem, ...expenses],
      };
    } catch (error: any) {
      throw error;
    }
  }

  private static async calculatePreviousBalance(beforeDate: Date): Promise<number> {
    const transactions = await prisma.transaction.findMany({
      where: {
        deleted_at: null,
        status: 'COMPLETED',
        effective_date: { lt: beforeDate },
      },
      select: {
        amount: true,
        category: { select: { type: true } },
      },
    });

    let balance = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (tx.category.type === 'INCOME') {
        balance += amount;
      } else {
        balance -= amount;
      }
    }

    return balance;
  }
}
