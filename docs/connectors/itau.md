# Itaú — guia de codificação (Pluggy)

## Identificação

- Connector / institution contendo `Itaú` / `Itau`
- Contas típicas: `ITAU MULTIPLO MC INTERNACIONAL`, `Itau Uniclass Visa Signature`, poupança/corrente `itau`

## Campos

| Campo Pluggy | Semântica Itaú |
|--------------|----------------|
| `bill.dueDate` | Dia 10 (comum) |
| `bill.billClosingDate` | ~dia 3 |
| `bill.payments[]` | **Pagamento da fatura ANTERIOR**, não desta. Ex.: fatura ago total `142.93` com `payments: [{ amount: 252.87 }]` (total de julho) |
| `account.balance` | Dívida total ≈ `creditLimit − availableCreditLimit` |
| Pagamento | `Pagamento PIX` / `PAGAMENTO COM SALDO` (valor negativo ≈ `totalAmount` da fatura paga), na data de vencimento |
| `billForecastDate` | Em geral **due month − 1** (offset 1) |

## Liquidação

1. **Nunca** usar `sum(payments) >= totalAmount` — o pagamento anexado é o do ciclo anterior e costuma ser ≥ o total atual → marca a fatura aberta como paga e pula para um mês vazio (fatura “zerada”).
2. `payments[]` só liquida se `|sum(payments) − totalAmount| ≤ 0.05` (cobertura exata desta fatura).
3. Caso contrário: tx `Pagamento PIX` / `PAGAMENTO COM SALDO` / `Pagamento…` com `|amount| ≈ totalAmount` e data no mês de vencimento (ou ≥ `dueDate`).

Helper: `isBillSettled` + `isBillPayment` em `creditBillPeriod.js`. Perfil: `itau` em `profiles.js`.

## Exemplo validado (Jesse, ago/2026)

- Cartão **Itau Uniclass Visa Signature** final 7823
- Fatura oficial venc. `2026-08-10`, total **R$ 142,93**
- `payments[]`: `[{ paymentDate: 2026-07-10, amount: 252.87 }]` ← total da fatura de **julho**
- Tx `2026-08-10` · `Pagamento PIX` · **-142.93** · `billForecastDate: 2026-08`
- Bug antigo: agosto aparecia como paga antes do PIX → open cycle ia para set/out com total 0; Momento Financeiro não listava agosto como pendente

## Armadilhas

- Confiar em `paid >= total` em `payments[]` → todas as faturas oficiais “pagas”, fatura aberta no mês seguinte **vazia**.
- Cartões satélite com limite R$ 200 e 0 lançamentos (`ITAU MULTIPLO…` 7522 / 9772) não são o cartão principal — usar o Uniclass com movimento.
- Offset forecast→due = 1; perfil fixa isso para não depender só da inferência.
