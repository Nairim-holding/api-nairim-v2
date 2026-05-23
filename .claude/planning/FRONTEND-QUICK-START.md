# Frontend Quick Start - Planning Routes

## 📋 TL;DR - Copy This Checklist

**Para não ter erro, sempre validar ANTES de enviar:**

- [ ] POST /planning?
  - ✅ `category_id` não-vazio (UUID string)
  - ✅ `year` entre 2000-2100
  - ✅ `type` = "FIXED" ou "VARIABLE"
  - ✅ Se FIXED: `default_amount` ≥ 0
  - ✅ Se VARIABLE: `monthly_values` com 12 meses (1-12), sem duplicatas, amounts ≥ 0
  - ✅ Authorization header com token válido

- [ ] GET /planning?year=YYYY
  - ✅ `year` entre 2000-2100
  - ✅ Authorization header

- [ ] GET /planning/:id
  - ✅ `id` é UUID válido
  - ✅ Planning existe
  - ✅ Authorization header

- [ ] DELETE /planning/:id
  - ✅ Confirmação do usuário
  - ✅ `id` é UUID válido
  - ✅ Authorization header

- [ ] GET /planning/dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  - ✅ Formato YYYY-MM-DD em ambas
  - ✅ startDate ≤ endDate
  - ✅ Datas válidas
  - ✅ Authorization header

---

## 🚨 Common Errors & How to Fix

### Error: "category_id é obrigatório"
```javascript
❌ WRONG: { category_id: "" }
✅ RIGHT: { category_id: "550e8400-e29b-41d4-a716-446655440000" }
```

### Error: "year deve estar entre 2000 e 2100"
```javascript
❌ WRONG: { year: 2030 }
✅ RIGHT: { year: 2026 }
```

### Error: "type deve ser FIXED ou VARIABLE"
```javascript
❌ WRONG: { type: "fixed" } // lowercase
✅ RIGHT: { type: "FIXED" } // uppercase
```

### Error: "default_amount é obrigatório para planejamentos do tipo FIXED"
```javascript
// Type FIXED:
❌ WRONG: { type: "FIXED", monthly_values: [...] }
✅ RIGHT: { type: "FIXED", default_amount: 5000 }

// Type VARIABLE:
❌ WRONG: { type: "VARIABLE", default_amount: 5000 }
✅ RIGHT: { type: "VARIABLE", monthly_values: [...] }
```

### Error: "monthly_values não pode conter meses duplicados"
```javascript
❌ WRONG: [
  { month: 1, amount: 1500 },
  { month: 1, amount: 1600 } // Duplicated!
]

✅ RIGHT: [
  { month: 1, amount: 1500 },
  { month: 2, amount: 1600 },
  ...
]
```

### Error: "startDate não pode ser maior que endDate"
```javascript
❌ WRONG: startDate=2026-12-31&endDate=2026-01-01
✅ RIGHT: startDate=2026-01-01&endDate=2026-12-31
```

### Error: "startDate deve estar no formato YYYY-MM-DD"
```javascript
❌ WRONG: "01/01/2026" or "01-01-2026" or "2026/01/01"
✅ RIGHT: "2026-01-01"
```

---

## 📊 Response Structure - What You'll Get Back

### POST /planning Response
```javascript
{
  success: true,
  data: {
    id: "uuid",
    category_id: "uuid",
    subcategory_id: "uuid or null",
    year: 2026,
    type: "FIXED or VARIABLE",
    default_amount: "5000.00 or null",
    min_recommended: "4500.00 or null",      // Auto-calculated!
    max_recommended: "5800.00 or null",      // Auto-calculated!
    is_active: true,
    created_at: "2026-05-18T10:30:00Z",
    updated_at: "2026-05-18T10:30:00Z",
    monthly_values: [
      { id: "uuid", planning_id: "uuid", month: 1, amount: "5000.00" },
      { id: "uuid", planning_id: "uuid", month: 2, amount: "5000.00" },
      ...
    ]
  },
  message: "Planejamento salvo com sucesso"
}
```

### GET /planning Response
```javascript
{
  success: true,
  data: [
    {
      id: "cat-uuid",
      name: "Despesas",
      type: "EXPENSE",
      is_active: true,
      planning: { id, category_id, type, ... },  // Or null
      subcategories: [
        {
          id: "subcat-uuid",
          name: "Aluguel",
          is_active: true,
          planning: { id, category_id, ... }  // Or null
        }
      ]
    }
  ],
  message: "Planejamentos recuperados com sucesso"
}
```

### GET /planning/dashboard Response
```javascript
{
  success: true,
  data: {
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    balances: {
      monthly: [
        { month: 1, year: 2026, realized_amount: 2500.00 },
        { month: 2, year: 2026, realized_amount: 2650.00 }
      ],
      accumulated: [
        { month: 1, year: 2026, realized_amount: 2500.00 },
        { month: 2, year: 2026, realized_amount: 5150.00 }
      ]
    },
    incomes: [
      {
        id: "uuid",
        name: "Total de Receitas",
        type: "INCOME",
        planned_amount: 48000.00,
        realized_amount: 48500.00,
        percentage: 101.04,
        min: 3800.00,
        med: 4041.67,
        max: 4200.00,
        monthly_data: [
          { month: 1, year: 2026, realized_amount: 4000.00 },
          { month: 2, year: 2026, realized_amount: 4100.00 }
        ],
        subcategories: [...]
      }
    ],
    expenses: [...]
  },
  message: "Dashboard de planejamento recuperado com sucesso"
}
```

---

## 🛠️ Copy & Paste Ready Code

**See file: `FRONTEND-CODE-EXAMPLES.md`**

All functions ready to use:
- `createFixedPlanning()`
- `createVariablePlanning()`
- `getPlanningsByYear(year)`
- `getPlanningById(planningId)`
- `deletePlanning(planningId)`
- `getDashboard(startDate, endDate)`
- Error handling pattern

---

## 🔐 Authentication

**EVERY request needs this header:**
```javascript
"Authorization": `Bearer ${localStorage.getItem("token")}`
```

If missing or invalid:
```javascript
{
  success: false,
  message: "Token inválido ou expirado"
}
```

---

## ✅ Testing Your Integration

```bash
# 1. Create FIXED planning
POST /planning
{
  "category_id": "UUID",
  "year": 2026,
  "type": "FIXED",
  "default_amount": 5000
}
# Expected: 200 with planning data

# 2. Create VARIABLE planning
POST /planning
{
  "category_id": "UUID",
  "subcategory_id": "UUID",
  "year": 2026,
  "type": "VARIABLE",
  "monthly_values": [
    {"month": 1, "amount": 1500},
    {"month": 2, "amount": 1600},
    ... (all 12 months)
  ]
}
# Expected: 200 with planning data

# 3. List plannings
GET /planning?year=2026
# Expected: 200 with array of categories

# 4. Get dashboard
GET /planning/dashboard?startDate=2026-01-01&endDate=2026-12-31
# Expected: 200 with dashboard metrics

# 5. Update planning (POST with same category_id, year, type)
# Expected: 200 with updated data (new months should be in response)

# 6. Delete planning
DELETE /planning/UUID
# Expected: 200 with success message

# ✅ All should return 200 with no validation errors!
```

---

## 📞 Still Getting Errors?

**Check these in order:**

1. **Is your token valid?** 
   → Try logging in again, get new token

2. **Is your JSON format correct?**
   → Use `JSON.stringify()` to verify, not string concatenation

3. **Are all REQUIRED fields present?**
   → See ROUTES-REQUIREMENTS.md for exact requirements per route

4. **Are field values valid?**
   → `month: 1-12`, `amount: ≥ 0`, `year: 2000-2100`, dates: YYYY-MM-DD

5. **Is the request reaching the backend?**
   → Check browser DevTools Network tab, look at request/response

6. **See validation errors in response?**
   → Copy error message, search in ROUTES-REQUIREMENTS.md for explanation

---

## 📚 Full Documentation

- `ROUTES-REQUIREMENTS.md` — Detailed requirements per route
- `FRONTEND-CODE-EXAMPLES.md` — Copy & paste ready code
- `API-CONTRACTS.md` — JSON request/response examples
