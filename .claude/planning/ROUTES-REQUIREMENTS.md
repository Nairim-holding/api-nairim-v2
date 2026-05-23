# Planning Routes - Exact Requirements

## 🚀 POST /planning (Create/Update)

### Request Requirements

```json
{
  "category_id": "string (UUID) - REQUIRED",
  "subcategory_id": "string (UUID) | null - OPTIONAL",
  "year": "number - REQUIRED (2000-2100)",
  "type": "FIXED | VARIABLE - REQUIRED",
  
  "default_amount": "number ≥ 0 - REQUIRED if type=FIXED",
  "monthly_values": [
    {
      "month": "number (1-12) - REQUIRED",
      "amount": "number ≥ 0 - REQUIRED"
    }
  ] "REQUIRED if type=VARIABLE, must have 1-12 items, no duplicates"
}
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `category_id` | Non-empty string | "category_id é obrigatório" |
| `year` | Valid number 2000-2100 | "year deve estar entre 2000 e 2100" |
| `type` | "FIXED" \| "VARIABLE" | "type deve ser FIXED ou VARIABLE" |
| `default_amount` (FIXED) | Non-negative number | "default_amount deve ser um número não negativo" |
| `monthly_values` (VARIABLE) | Array with 1-12 items | "monthly_values é obrigatório para planejamentos do tipo VARIABLE" |
| Monthly months | 1-12, no duplicates | "monthly_values[X].month deve ser um número entre 1 e 12" |
| Monthly amounts | Non-negative numbers | "monthly_values[X].amount deve ser um número não negativo" |

### ✅ Success Examples

#### FIXED Type
```json
{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "year": 2026,
  "type": "FIXED",
  "default_amount": 5000
}
```

#### VARIABLE Type
```json
{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "subcategory_id": "660e8400-e29b-41d4-a716-446655440001",
  "year": 2026,
  "type": "VARIABLE",
  "monthly_values": [
    { "month": 1, "amount": 1500 },
    { "month": 2, "amount": 1600 },
    { "month": 3, "amount": 1550 },
    { "month": 4, "amount": 1700 },
    { "month": 5, "amount": 1650 },
    { "month": 6, "amount": 1800 },
    { "month": 7, "amount": 1750 },
    { "month": 8, "amount": 1900 },
    { "month": 9, "amount": 1850 },
    { "month": 10, "amount": 2000 },
    { "month": 11, "amount": 1950 },
    { "month": 12, "amount": 2100 }
  ]
}
```

### ✅ Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "category_id": "550e8400-e29b-41d4-a716-446655440000",
    "subcategory_id": null,
    "year": 2026,
    "type": "FIXED",
    "default_amount": "5000.00",
    "min_recommended": "4500.00",
    "max_recommended": "5800.00",
    "is_active": true,
    "created_at": "2026-05-18T10:30:00Z",
    "updated_at": "2026-05-18T10:30:00Z",
    "monthly_values": [
      { "id": "uuid", "planning_id": "uuid", "month": 1, "amount": "5000.00" },
      { "id": "uuid", "planning_id": "uuid", "month": 2, "amount": "5000.00" },
      ...
    ]
  },
  "message": "Planejamento salvo com sucesso"
}
```

### ❌ Error Response (400)

```json
{
  "success": false,
  "message": "Erro de validação",
  "errors": [
    "category_id é obrigatório",
    "year deve estar entre 2000 e 2100"
  ]
}
```

---

## 🔍 GET /planning?year=YYYY

### Query Parameters

```
year: number (REQUIRED) - 2000-2100
```

### Validation Rules

| Parameter | Rule | Error Message |
|-----------|------|---------------|
| `year` | Required, valid number 2000-2100 | "year deve ser um número válido entre 2000 e 2100" |

### ✅ Request Example

```
GET /planning?year=2026
```

### ✅ Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "cat-uuid",
      "name": "Despesas",
      "type": "EXPENSE",
      "is_active": true,
      "planning": {
        "id": "planning-uuid",
        "category_id": "cat-uuid",
        "subcategory_id": null,
        "year": 2026,
        "type": "FIXED",
        "default_amount": "5000.00",
        "min_recommended": "4500.00",
        "max_recommended": "5800.00",
        "monthly_values": [...]
      },
      "subcategories": [
        {
          "id": "subcat-uuid",
          "category_id": "cat-uuid",
          "name": "Aluguel",
          "is_active": true,
          "planning": {
            "id": "planning-uuid",
            "monthly_values": [...]
          }
        }
      ]
    }
  ],
  "message": "Planejamentos recuperados com sucesso"
}
```

### ❌ Error Response (400)

```json
{
  "success": false,
  "message": "Erro de validação",
  "errors": ["year deve ser um número válido entre 2000 e 2100"]
}
```

---

## 📋 GET /planning/:id

### Path Parameters

```
id: string (UUID) - REQUIRED
```

### ✅ Request Example

```
GET /planning/550e8400-e29b-41d4-a716-446655440000
```

### ✅ Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "category_id": "cat-uuid",
    "subcategory_id": "subcat-uuid",
    "year": 2026,
    "type": "VARIABLE",
    "default_amount": null,
    "min_recommended": "1200.00",
    "max_recommended": "2500.00",
    "is_active": true,
    "created_at": "2026-05-18T10:30:00Z",
    "updated_at": "2026-05-18T10:30:00Z",
    "category": {
      "id": "cat-uuid",
      "name": "Despesas",
      "type": "EXPENSE"
    },
    "subcategory": {
      "id": "subcat-uuid",
      "category_id": "cat-uuid",
      "name": "Aluguel"
    },
    "monthly_values": [
      { "id": "uuid", "planning_id": "uuid", "month": 1, "amount": "1500.00" },
      { "id": "uuid", "planning_id": "uuid", "month": 2, "amount": "1600.00" }
    ]
  },
  "message": "Planejamento recuperado com sucesso"
}
```

### ❌ Error Response (404)

```json
{
  "success": false,
  "message": "Planejamento não encontrado"
}
```

---

## 🗑️ DELETE /planning/:id

### Path Parameters

```
id: string (UUID) - REQUIRED
```

### ✅ Request Example

```
DELETE /planning/550e8400-e29b-41d4-a716-446655440000
```

### ✅ Success Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Planejamento removido com sucesso"
}
```

### ❌ Error Response (404)

```json
{
  "success": false,
  "message": "Planejamento não encontrado"
}
```

---

## 📊 GET /planning/dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD

### Query Parameters

```
startDate: string (REQUIRED) - formato YYYY-MM-DD
endDate: string (REQUIRED) - formato YYYY-MM-DD
startDate deve ser ≤ endDate
```

### Validation Rules

| Parameter | Rule | Error Message |
|-----------|------|---------------|
| `startDate` | Required, formato YYYY-MM-DD, data válida | "startDate é obrigatório (formato: YYYY-MM-DD)" |
| `endDate` | Required, formato YYYY-MM-DD, data válida | "endDate é obrigatório (formato: YYYY-MM-DD)" |
| Date order | startDate ≤ endDate | "startDate não pode ser maior que endDate" |

### ✅ Request Example

```
GET /planning/dashboard?startDate=2026-01-01&endDate=2026-12-31
```

### ✅ Success Response (200)

```json
{
  "success": true,
  "data": {
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "balances": {
      "monthly": [
        { "month": 1, "year": 2026, "realized_amount": 2500.00 },
        { "month": 2, "year": 2026, "realized_amount": 2650.00 }
      ],
      "accumulated": [
        { "month": 1, "year": 2026, "realized_amount": 2500.00 },
        { "month": 2, "year": 2026, "realized_amount": 5150.00 }
      ]
    },
    "incomes": [
      {
        "id": "incomes-global",
        "name": "Total de Receitas",
        "type": "INCOME",
        "planned_amount": 48000.00,
        "realized_amount": 48500.00,
        "percentage": 101.04,
        "min": 3800.00,
        "med": 4041.67,
        "max": 4200.00,
        "monthly_data": [
          { "month": 1, "year": 2026, "realized_amount": 4000.00 }
        ],
        "subcategories": [...]
      }
    ],
    "expenses": [...]
  },
  "message": "Dashboard de planejamento recuperado com sucesso"
}
```

### ❌ Error Response (400)

```json
{
  "success": false,
  "message": "Erro de validação",
  "errors": [
    "startDate é obrigatório (formato: YYYY-MM-DD)",
    "startDate não pode ser maior que endDate"
  ]
}
```

---

## 🔐 Authentication

**TODAS as rotas requerem**: `Authorization: Bearer <jwt_token>`

Se token ausente ou inválido:
```json
{
  "success": false,
  "message": "Token inválido ou expirado"
}
```

---

## ⚠️ Common Mistakes to Avoid

| Erro | Causa | Solução |
|------|-------|---------|
| "default_amount é obrigatório" | Esqueceu de enviar para FIXED | Sempre enviar `default_amount` se `type=FIXED` |
| "monthly_values é obrigatório" | Esqueceu para VARIABLE | Sempre enviar `monthly_values` se `type=VARIABLE` |
| "monthly_values não pode conter meses duplicados" | Meses repetidos (ex: 2 itens com `month=1`) | Certifique que cada mês aparece 1x |
| "startDate não pode ser maior que endDate" | Datas invertidas | Verificar se `startDate ≤ endDate` |
| "startDate deve estar no formato YYYY-MM-DD" | Formato errado (ex: "01/01/2026") | Sempre usar "YYYY-MM-DD" |
| "default_amount deve ser um número não negativo" | Enviou número negativo | Sempre enviar ≥ 0 |
| "Planejamento não encontrado" | ID não existe | Verificar se planning_id está correto |

---

## 📝 Frontend Checklist

- ✅ POST: Validar `category_id` não-vazio
- ✅ POST: Se FIXED, enviar `default_amount`
- ✅ POST: Se VARIABLE, enviar `monthly_values` com todos 12 meses
- ✅ GET: Enviar `year` válido
- ✅ DELETE: Verificar se planning existe antes de deletar
- ✅ DASHBOARD: Enviar datas no formato YYYY-MM-DD
- ✅ DASHBOARD: Verificar se startDate ≤ endDate
- ✅ TODAS as rotas: Incluir Authorization header
