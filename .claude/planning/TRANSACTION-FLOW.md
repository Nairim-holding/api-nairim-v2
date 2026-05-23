# Transaction Flow: Before & After Fix

## BEFORE FIX ❌ (Bug)

```
User POST /planning

  ↓
Controller.upsert()
  ↓
Service.upsertPlanning()
  ├─ findFirst() planning
  ├─ calculateMinMax()
  ├─ IF existing:
  │   ├─ planning.update()         ✓ SUCCESS
  │   │
  │   ├─ planningMonth.deleteMany() ← Could fail silently!
  │   │   └─ If fails: old months stay in DB
  │   │
  │   ├─ planningMonth.createMany() ← Only runs if delete succeeded
  │   │   └─ If delete failed: THIS DOESN'T RUN
  │   │
  │   └─ (No rollback for update!)
  │
  ├─ planning.findUnique()         ✓ Returns OLD months
  │   └─ Dashboard sums old amounts
  │
└─ Response 200 ✓ (but DB is inconsistent!)

PROBLEM: Delete can fail silently, leaving old data in DB
```

## AFTER FIX ✅ (Working)

```
User POST /planning

  ↓
Controller.upsert()
  ↓
Service.upsertPlanning()
  ├─ findFirst() planning
  ├─ calculateMinMax()
  ├─ IF existing:
  │   ├─ START TRANSACTION
  │   │   ├─ planning.update()         ✓ SUCCESS
  │   │   ├─ planningMonth.deleteMany() ✓ MUST SUCCEED
  │   │   ├─ planningMonth.createMany() ✓ MUST SUCCEED
  │   │   └─ [All-or-nothing guarantee]
  │   └─ END TRANSACTION (auto-commit if all succeeded)
  │
  ├─ planning.findUnique()         ✓ Returns NEW months
  │   └─ Dashboard sums new amounts
  │
└─ Response 200 ✓ (DB is guaranteed consistent!)

GUARANTEE: If ANY step fails, ENTIRE transaction rolls back
          No orphaned data, no partial updates
```

## Key Difference

| Aspect | Before | After |
|--------|--------|-------|
| **Guarantee** | None ❌ | All-or-nothing ✅ |
| **Rollback** | Manual (not done) ❌ | Automatic ✅ |
| **Orphaned data** | Possible ❌ | Impossible ✅ |
| **Silent failures** | Can hide errors ❌ | Explicit errors ✅ |
| **Data consistency** | Maybe 🤔 | Always ✅ |

## Code Pattern

```typescript
// BEFORE: No transaction wrapper
if (existing) {
  planning = await prisma.planning.update({...});
  await prisma.planningMonth.deleteMany({...});
  await prisma.planningMonth.createMany({...});
}

// AFTER: Transaction wrapper ensures atomicity
if (existing) {
  planning = await prisma.$transaction(async (tx) => {
    const updated = await tx.planning.update({...});
    await tx.planningMonth.deleteMany({...});
    await tx.planningMonth.createMany({...});
    return updated;
  });
}
```

## When Transaction Rolls Back

✅ Scenario: All operations succeed
  → Data persists, response 200

❌ Scenario: deleteMany fails
  → Entire transaction reverts
  → No update, no create
  → Error thrown to frontend
  → Frontend shows error message

✅ Result: Frontend & DB always consistent
