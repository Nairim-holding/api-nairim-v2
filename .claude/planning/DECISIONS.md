# Architectural Decisions - Planning Module

## Decision 1: Persist vs. Calculate Dynamically

**CHOSEN**: Persist at creation/update time

| Aspect | Persist | Dynamic |
|--------|---------|---------|
| GET /planning/:id | O(1) ⚡ | O(N) 🐢 |
| Auditability | ✅ Snapshot | ❌ No history |
| Scalability | ✅ Linear | ⚠️ Degrades |
| Consistency | ✅ Immutable | ⚠️ Changes with data |
| Caching | ✅ None needed | ⚠️ Complex |

**Benefit**: Planning becomes a "snapshot" - allows historical comparison and provides audit trail.

## Decision 2: No Zod/Yup Validation

**CHOSEN**: Use native TypeScript only

- Existing pattern: Custom validator class with manual checks
- Applied to: `min_recommended` validation (now removed)
- Consistent with project architecture
- No new dependencies

## Decision 3: Calculation Scope

**CHOSEN**: All transaction history (no date filter)

- MIN/MAX based on complete history, not just period
- Represents actual data range for the category
- More stable and meaningful for planning
- No sliding window complexity

## Decision 4: Null Handling

**CHOSEN**: null if no transaction history

- Category with zero transactions → min=null, max=null
- Clear signal that planning is "cold start"
- Dashboard handles null gracefully (already does)
- Frontend can show N/A or skip min/max display

## Decision 5: Subcategory Inheritance

**NOT IMPLEMENTED**: Category doesn't inherit min/max from subcategories

- Planning is explicit per level (category or subcategory)
- No implicit calculation from children
- Simpler, more predictable behavior
- Dashboard aggregates at display time only
