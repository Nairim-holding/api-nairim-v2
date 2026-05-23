# Next Steps & Testing

## Testing Checklist
```
[ ] Unit test: calculateMinMaxFromTransactionHistory()
    - With history (should return min/max)
    - Without history (should return null/null)
    - Single month (should return same value for min and max)
    
[ ] Integration test: POST /planning with VARIABLE type
    - Verify min/max are calculated and persisted
    - Verify response includes min/max fields
    
[ ] Integration test: POST /planning with FIXED type
    - Verify default_amount doesn't affect min/max calculation
    
[ ] E2E test: GET /planning/dashboard
    - Verify min/med/max metrics in response
    - Verify subcategory aggregation includes min/max
    
[ ] Legacy request test:
    - POST /planning with min_recommended in body
    - Should be ignored (no error, not persisted)
```

## Frontend Changes Required
- Remove `min_recommended` and `max_recommended` input fields
- Update request payload (no longer send these)
- Update response handling to display min/med/max from response
- Dashboard: Render min/med/max in chart legends or table

## Monitoring (Post-Deploy)
- Check min/max values are calculated on first planning creation
- Monitor calculateMinMaxFromTransactionHistory() query performance
- Alert if transaction count exceeds 100k (reconsider caching)

## Documentation Updates
- API docs: Remove min/max from request schema
- API docs: Add min/max to response schema
- Changelog: Note breaking change (min/max no longer accepted)
- Deprecation: If legacy clients exist, provide migration guide

## Optional Optimizations (Future)
- Cache transaction sums per category/month (if > 100k transactions)
- Batch calculate for multiple categories on bulk import
- Add background job to recalculate when category has new transactions (if requirements change)
