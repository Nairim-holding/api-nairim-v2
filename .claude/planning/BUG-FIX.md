# Bug Fix: Planning Data Not Persisting (2026-05-18)

## Problem
```
✅ POST /planning returns 200 + "Planejamento salvo com sucesso"
✅ Frontend receives response successfully
✅ Optimistic update happens
❌ Database is NOT updated
❌ Refetch returns OLD data
```

## Root Cause
**NO TRANSACTION in upsertPlanning()**

When updating existing planning:
```typescript
// BEFORE FIX: These were separate, unrelated operations
planning = await prisma.planning.update(...);
await prisma.planningMonth.deleteMany(...);
await prisma.planningMonth.createMany(...);
```

**Issue sequence**:
1. `planning.update()` = SUCCESS ✓
2. `planningMonth.deleteMany()` = Could fail silently
3. If deleteMany fails, old months stay in DB
4. `planningMonth.createMany()` = Never runs
5. `findUnique()` returns planning with OLD months
6. Dashboard sums old months → OLD planned_amount shown

**Why it appeared to work**:
- No try/catch error thrown
- Response returned success
- But data in DB was inconsistent

## Solution
**Use Prisma transactions (`$transaction`)**

### Changed Code
```typescript
// BEFORE: Sequential operations without guarantee
if (existing) {
  planning = await prisma.planning.update({...});
  await prisma.planningMonth.deleteMany({...});
  await prisma.planningMonth.createMany({...});
}

// AFTER: Atomic transaction (all-or-nothing)
if (existing) {
  planning = await prisma.$transaction(async (tx) => {
    const updated = await tx.planning.update({...});
    await tx.planningMonth.deleteMany({...});
    await tx.planningMonth.createMany({...});
    return updated;
  });
}
```

**Benefits**:
- ✅ All-or-nothing execution
- ✅ Automatic rollback if any step fails
- ✅ No orphaned/partial data
- ✅ Consistent state guaranteed

## File Modified
`src/services/PlanningService.ts` - `upsertPlanning()` method

## Verification Steps
```bash
# 1. Compile
npm run build

# 2. Test update existing planning
curl -X POST http://localhost:5000/planning \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "category_id": "existing-cat",
    "year": 2026,
    "type": "FIXED",
    "default_amount": 5000
  }'

# 3. Verify in DB
SELECT * FROM "Planning" WHERE category_id = 'existing-cat' AND year = 2026;
SELECT * FROM "PlanningMonth" WHERE planning_id = '<returned-id>';

# 4. Check dashboard
curl "http://localhost:5000/planning/dashboard?startDate=2026-01-01&endDate=2026-12-31"
# planned_amount should reflect new values
```

## Impact
- 🟢 Fixes missing data persistence
- 🟢 Prevents orphaned records
- 🟢 Ensures frontend/DB consistency
- 🔴 No breaking changes (API contract same)
