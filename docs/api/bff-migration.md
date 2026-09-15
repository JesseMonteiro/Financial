# BFF migration — legacy → /v1

## Goals

- Keep the web client working on unversioned paths (`/accounts`, `/transactions`, …).
- Give iOS a stable envelope under `/v1` with `data` / `meta` / `error`.
- Move domain CRUD (budgets, goals, receivables, manuals, profile) behind the BFF so the mobile app does not depend on Postgres schema details.
- Never return `pluggy_client_secret` to any client.

## Envelope

```json
{
  "data": {},
  "meta": {
    "calculationVersion": "2026.09.2",
    "requestId": "uuid",
    "generatedAt": "ISO-8601"
  },
  "error": null
}
```

## Paths

| Legacy | v1 |
|---|---|
| `GET /health` | `GET /v1/health` |
| `GET /feature-flags` | `GET /v1/feature-flags` |
| `GET /accounts` | `GET /v1/accounts` |
| `GET /dashboard` | `GET /v1/dashboard` |
| `GET /credit-cards` | `GET /v1/credit-cards` |
| `GET /agenda` | `GET /v1/agenda` |
| `GET /budget-screen` | `GET /v1/budget-screen` |
| `GET /reports` | `GET /v1/reports` |
| `GET /subscriptions` | `GET /v1/subscriptions` |
| — | `GET/POST/PATCH/DELETE /v1/domain/*` |

Domain resources include `budgets`, `goals`, `receivables`, `manual-transactions`, `manual-accounts`, `meal-benefits`, `meal-benefit-purchases`, and `purchase-categories` (user-owned purchase category CRUD; seeds the 9 default manual keys on first empty GET). This is separate from Pluggy `GET /v1/categories`.

## Budget screen (`GET /budget-screen` and `/v1/budget-screen`)

Query: `month=YYYY-MM`. Each category row:

| Field | Meaning |
| --- | --- |
| `spent` | Banco/cartão + compras VA/VR do mês |
| `spentBank` / `spentMeal` | Breakdown das fontes |
| `period` | `daily` \| `weekly` \| `biweekly` \| `monthly` |
| `periodAmount` | Valor configurado por período (coluna `budgets.limit`) |
| `allowance` / `limit` | Verba já liberada no mês (períodos iniciados × `periodAmount`) |
| `monthCap` | Teto se todos os períodos do mês ocorrerem |
| `periodIndex` / `periodCount` | Progresso do período no mês |

VA sem `category` soma em `Supermercado & Alimentação`; VR em `Restaurantes & Bares`. `POST /v1/domain/budgets` faz upsert em `(user_id, category)` e aceita `period`.

`calculationVersion` atual: `2026.09.2`.

## Kill switches

Env vars: `KILL_PLUGGY`, `KILL_GEMINI`, `KILL_TELEGRAM`, `FEATURE_PUSH`.

## Rollout

1. Deploy Edge Function with `/v1` + legacy.
2. Point iOS staging to `/v1`.
3. Keep web on legacy until adapter in `src/services/api.js` optionally opts into `/v1`.
4. After both clients are on `/v1`, deprecate legacy in a later major.
