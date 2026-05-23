# Planning API Contracts

## POST /planning (Create/Update)
```json
{
  "category_id": "uuid",
  "subcategory_id": "uuid|null",
  "year": 2026,
  "type": "FIXED|VARIABLE",
  "default_amount": 5000 (required if FIXED),
  "monthly_values": [
    { "month": 1, "amount": 1500 },
    { "month": 2, "amount": 1600 }
  ] (required if VARIABLE)
}
```
**⚠️ NO min_recommended/max_recommended in request**

## GET /planning/:id
```json
{
  "id": "planning-uuid",
  "category_id": "uuid",
  "subcategory_id": "uuid|null",
  "year": 2026,
  "type": "VARIABLE",
  "min_recommended": "1200.00",
  "max_recommended": "2500.00",
  "monthly_values": [{ "month": 1, "amount": "1500.00" }]
}
```
**✅ min/max are auto-calculated, read-only**

## GET /planning/dashboard?startDate=2026-01-01&endDate=2026-12-31
```json
{
  "incomes": [
    {
      "id": "incomes-global",
      "name": "Total de Receitas",
      "type": "INCOME",
      "planned_amount": 48000,
      "realized_amount": 48500,
      "percentage": 101.04,
      "min": 3800,
      "med": 4041.67,
      "max": 4200,
      "monthly_data": [{ "month": 1, "year": 2026, "realized_amount": 4000 }],
      "subcategories": [{ "id": "subcat-id", "name": "Aluguel", ... }]
    }
  ],
  "expenses": [...]
}
```
**Dashboard metrics**: MIN (monthly minimum), MED (monthly average), MAX (monthly maximum)
