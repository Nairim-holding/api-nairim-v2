# Planning Module - Business Context

## Schema Core
```
Planning {
  id, category_id, subcategory_id, year, type (FIXED|VARIABLE)
  default_amount, min_recommended (auto), max_recommended (auto)
}
→ PlanningMonth[] (month: 1-12, amount: Decimal)

Transaction (historical source) {
  amount, effective_date, category_id, subcategory_id, status (PENDING|COMPLETED)
}
```

## Business Rules (EFFECTIVE NOW)
**MIN/MAX are system-calculated, NOT user input**
- MIN = smallest monthly sum in transaction history for category/subcategory
- MAX = largest monthly sum in transaction history for category/subcategory
- Calculated at creation/update time and persisted
- Provides audit trail and historical snapshot

## Input/Output Change
- ❌ Remove from requests: `min_recommended`, `max_recommended`
- ✅ Auto-calculate from Transaction history using groupBy(month-year)
- ✅ Return in responses as read-only fields

## Strategy: Persist at Save (not dynamic)
**Why**: O(1) GET performance, auditability, immutable snapshot, scales linearly
