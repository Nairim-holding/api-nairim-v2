# Code Changes - Planning Refactor

## Files Modified

### 1. src/lib/validators/planning.ts
**Removed** (lines 52-71): All validation for `min_recommended` and `max_recommended`
- 23 lines deleted
- These fields no longer accepted in requests

### 2. src/services/PlanningService.ts

**Updated**: `UpsertPlanningInput` interface
```typescript
// BEFORE
interface UpsertPlanningInput {
  // ...
  min_recommended?: number | null;
  max_recommended?: number | null;
  monthly_values?: MonthlyValueInput[];
}

// AFTER
interface UpsertPlanningInput {
  // ...
  monthly_values?: MonthlyValueInput[];
}
```

**Added**: Private method `calculateMinMaxFromTransactionHistory()`
```typescript
private static async calculateMinMaxFromTransactionHistory(
  categoryId: string,
  subcategoryId: string | null
): Promise<{ min: number | null; max: number | null }>

// Logic:
// 1. Find all transactions for category/subcategory (no date filter)
// 2. Group by YYYY-MM
// 3. Sum amounts per month
// 4. Return { min: lowest_month, max: highest_month }
// 5. Return null if no transactions
```

**Updated**: `upsertPlanning()` method
```typescript
// Now calls calculateMinMaxFromTransactionHistory() at start
const { min, max } = await this.calculateMinMaxFromTransactionHistory(
  data.category_id,
  data.subcategory_id ?? null
);

// Persists calculated values
const planningData = {
  // ...
  min_recommended: min,
  max_recommended: max,
};
```

## No Breaking Changes to Other Methods
- `getPlannings()` - unchanged
- `getPlanningById()` - unchanged
- `deletePlanning()` - unchanged
- `getPlanningDashboard()` - unchanged (already uses min/max from DB)

## Compilation Status
✅ TypeScript compiles successfully (npm run build)
