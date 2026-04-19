# 📅 Regras de Datas em Lançamentos Parcelados

## Visão Geral

O sistema implementa regras de negócio claras para datas em lançamentos parcelados, diferenciando:

1. **Data do Evento** (event_date): Quando ocorreu a transação
2. **Data da Compra** (purchase_date): Quando foi realizada a compra
3. **Data de Vencimento** (effective_date): Quando cada parcela vence

## 📋 Resumo das Mudanças

### Antes (Comportamento Anterior)
```
Lançamento: Compra parcelada em 3x
start_date: 2026-04-18

Parcela 1: event_date = 2026-04-18, effective_date = 2026-05-18
Parcela 2: event_date = 2026-05-18, effective_date = 2026-06-18  ❌ INCONSISTENTE
Parcela 3: event_date = 2026-06-18, effective_date = 2026-07-18  ❌ INCONSISTENTE

❌ Problema: event_date variava entre parcelas, causando inconsistência
```

### Depois (Novo Comportamento)
```
Lançamento: Compra parcelada em 3x
start_date: 2026-04-18

Parcela 1: event_date = 2026-04-18 ✅ CONSTANTE
           purchase_date = 2026-04-18 ✅ CONSTANTE
           effective_date = 2026-05-18 (vencimento 1)

Parcela 2: event_date = 2026-04-18 ✅ CONSTANTE
           purchase_date = 2026-04-18 ✅ CONSTANTE
           effective_date = 2026-06-18 (vencimento 2)

Parcela 3: event_date = 2026-04-18 ✅ CONSTANTE
           purchase_date = 2026-04-18 ✅ CONSTANTE
           effective_date = 2026-07-18 (vencimento 3)

✅ Correto: Todas as parcelas têm as mesmas event_date e purchase_date
```

## 🎯 Regras de Negócio

### Regra 1: Data do Evento (event_date)

**O que é:**
- Data em que a transação ocorreu
- Data da compra ou realização do evento

**Como funciona:**
- ✅ Definida uma vez no `start_date`
- ✅ IDÊNTICA em todas as parcelas
- ✅ Não muda nunca

**Exemplo:**
```
Compra em 2026-04-18, parcelada em 3x
event_date em TODAS as 3 parcelas = 2026-04-18
```

### Regra 2: Data da Compra (purchase_date)

**O que é:**
- Data exata em que a compra foi realizada
- Momento real da transação no mundo físico/financeiro

**Como funciona:**
- ✅ Definida uma vez no `start_date`
- ✅ IDÊNTICA em todas as parcelas
- ✅ Representa o momento original da compra

**Exemplo:**
```
Compra realizada em 2026-04-18, parcelada em 3x
purchase_date em TODAS as 3 parcelas = 2026-04-18
```

### Regra 3: Data de Vencimento (effective_date)

**O que é:**
- Data em que cada parcela deve ser paga
- Vencimento individual de cada parcela

**Como funciona:**
- ✅ VARIA entre parcelas
- ✅ Calculada a partir de `first_payment_date` + (meses)
- ✅ Cada parcela tem data de vencimento diferente

**Exemplo:**
```
Compra em 2026-04-18, 1ª parcela vence em 2026-05-18

Parcela 1: effective_date = 2026-05-18 (30 dias)
Parcela 2: effective_date = 2026-06-18 (60 dias)
Parcela 3: effective_date = 2026-07-18 (90 dias)
```

## 🔄 Fluxo de Criação de Parcelas

```
Input do Usuário:
├─ start_date: 2026-04-18 (data da compra)
├─ first_payment_date: 2026-05-18 (1ª parcela vence em)
├─ num_installments: 3
└─ installment_amount: R$ 100.00

              ↓

Sistema Processa:
├─ event_date constante = start_date (2026-04-18)
├─ purchase_date constante = start_date (2026-04-18)
└─ effective_dates calculadas:
   ├─ Parcela 1: 2026-05-18
   ├─ Parcela 2: 2026-06-18
   └─ Parcela 3: 2026-07-18

              ↓

Resultado (Banco de Dados):
Transaction 1: {
  event_date: 2026-04-18,
  purchase_date: 2026-04-18,
  effective_date: 2026-05-18,
  installment_number: 1
}

Transaction 2: {
  event_date: 2026-04-18,
  purchase_date: 2026-04-18,
  effective_date: 2026-06-18,
  installment_number: 2
}

Transaction 3: {
  event_date: 2026-04-18,
  purchase_date: 2026-04-18,
  effective_date: 2026-07-18,
  installment_number: 3
}
```

## 📊 Tabela Comparativa de Datas

| Campo | Tipo | Constante? | Finalidade | Exemplo |
|-------|------|-----------|-----------|---------|
| `event_date` | Date | ✅ SIM | Quando ocorreu | 2026-04-18 |
| `purchase_date` | Date | ✅ SIM | Quando foi comprado | 2026-04-18 |
| `effective_date` | Date | ❌ NÃO | Vencimento cada parcela | 2026-05-18, 06-18, 07-18 |
| `created_at` | DateTime | - | Criação no sistema | 2026-04-18 10:30:15 |
| `updated_at` | DateTime | - | Última atualização | 2026-04-18 10:30:15 |

## 🔍 Validações

### Validações de Data

```
start_date (evento/compra):
  - Obrigatório
  - Não pode ser no futuro
  - Usado para event_date e purchase_date

first_payment_date (vencimento da 1ª parcela):
  - Obrigatório
  - Deve ser >= start_date
  - Base para calcular effective_date das demais

Resultado:
  - event_date sempre = start_date
  - purchase_date sempre = start_date
  - effective_date >= first_payment_date
```

## 💡 Benefícios

### 1. Rastreabilidade Financeira
```
Pergunta: "Quando foi essa compra?"
Resposta: "Veja purchase_date e event_date - ambas são 2026-04-18"

Pergunta: "Quanto cada parcela vence?"
Resposta: "Veja effective_date de cada parcela"
```

### 2. Consistência nos Relatórios
```
Relatório de Compras (por data):
- Todas as 3 parcelas aparecem com data 2026-04-18
- Facilitando análise de "compras do período"

Relatório de Vencimentos (por effective_date):
- Parcela 1 em 2026-05-18
- Parcela 2 em 2026-06-18
- Parcela 3 em 2026-07-18
- Facilitando planejamento de caixa
```

### 3. Auditoria e Compliance
```
Rastreamento claro de quando a transação aconteceu
vs.
Quando ela precisa ser paga

Importante para:
- Relatórios contábeis
- Análise de fluxo de caixa
- Conformidade regulatória
```

## 🛠️ Implementação Técnica

### Código na Service

```typescript
// ANTES (incorreto)
const eventDate = new Date(startDate);
eventDate.setMonth(startDate.getMonth() + index); // ❌ Alterava a cada parcela

// DEPOIS (correto)
const constantEventDate = new Date(startDate);
const eventDate = new Date(constantEventDate); // ✅ Sempre igual
```

### Schema Prisma

```prisma
model Transaction {
  event_date       DateTime  @db.Date      // Data do evento (constante)
  purchase_date    DateTime? @db.Date      // Data da compra (constante)
  effective_date   DateTime  @db.Date      // Data de vencimento (varia)
  
  // Para parcelamentos:
  installment_number  Int?               // Qual parcela (1, 2, 3...)
  total_installments  Int?               // Total de parcelas
}
```

## 📝 Exemplos de Casos de Uso

### Caso 1: Compra Parcelada no Débito

```json
{
  "start_date": "2026-04-18",
  "first_payment_date": "2026-05-18",
  "num_installments": 3,
  "installment_amount": 100.00
}

Resultado:
Parcela 1: {
  "event_date": "2026-04-18",
  "purchase_date": "2026-04-18",
  "effective_date": "2026-05-18"
}

Parcela 2: {
  "event_date": "2026-04-18",
  "purchase_date": "2026-04-18",
  "effective_date": "2026-06-18"
}

Parcela 3: {
  "event_date": "2026-04-18",
  "purchase_date": "2026-04-18",
  "effective_date": "2026-07-18"
}
```

### Caso 2: Compra no Cartão de Crédito (3x)

```json
{
  "start_date": "2026-04-18",
  "first_payment_date": "2026-05-18",
  "num_installments": 3,
  "card_id": "abc123",
  "installment_amount": 150.00
}

Resultado:
- Todas as 3 parcelas: event_date = 2026-04-18
- Todas as 3 parcelas: purchase_date = 2026-04-18
- Fatura de maio: Parcela 1 (vence 2026-05-18)
- Fatura de junho: Parcela 2 (vence 2026-06-18)
- Fatura de julho: Parcela 3 (vence 2026-07-18)
```

## ⚠️ Notas Importantes

### Migração de Dados Anteriores

Se você tiver dados anteriores com `event_date` variável:

```sql
-- Consulta para identificar parcelas com event_date inconsistente
SELECT 
  parent_id,
  installment_number,
  event_date,
  COUNT(*) 
FROM transactions
WHERE parent_id IS NOT NULL
GROUP BY parent_id, installment_number, event_date
HAVING COUNT(*) > 1;
```

Para correção, você pode:
1. Usar `purchase_date` como referência
2. Copiar a data da 1ª parcela para as demais
3. Executar script de migração (contate suporte)

### Consultas Recomendadas

```sql
-- Compras do período (evento)
SELECT * FROM transactions
WHERE DATE(event_date) BETWEEN '2026-04-01' AND '2026-04-30'
ORDER BY event_date DESC;

-- Vencimentos do período
SELECT * FROM transactions
WHERE DATE(effective_date) BETWEEN '2026-05-01' AND '2026-05-31'
ORDER BY effective_date ASC;

-- Todas as parcelas de uma compra
SELECT * FROM transactions
WHERE purchase_date = '2026-04-18'
ORDER BY installment_number ASC;
```

## 🎓 Referência Rápida

| Pergunta | Campo | Valor |
|----------|-------|-------|
| Quando foi comprado? | `purchase_date` | Uma data para todas |
| Quando ocorreu? | `event_date` | Uma data para todas |
| Quando vence parcela 1? | `effective_date` | Data específica |
| Quando vence parcela 2? | `effective_date` | Data específica |
| Qual é a parcela? | `installment_number` | 1, 2, 3... |

---

**Versão**: 1.0  
**Data**: 2026-04-18  
**Status**: ✅ Implementado e Testado
