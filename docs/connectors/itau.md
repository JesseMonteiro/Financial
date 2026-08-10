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
| `billForecastDate` (POSTED + `billId`) | Costuma ser **due − 1** |
| `billForecastDate` (PENDING futuro sem `billId`) | Já é o **mês de vencimento** da fatura em que a parcela cai (`fc === due`) |

## Liquidação

1. **Nunca** usar `sum(payments) >= totalAmount` — o pagamento anexado é o do ciclo anterior e costuma ser ≥ o total atual → marca a fatura aberta como paga e pula para um mês vazio (fatura “zerada”).
2. `payments[]` só liquida se `|sum(payments) − totalAmount| ≤ 0.05` (cobertura exata desta fatura).
3. Caso contrário: tx `Pagamento PIX` / `PAGAMENTO COM SALDO` / `Pagamento…` com `|amount| ≈ totalAmount` e data no mês de vencimento (ou ≥ `dueDate`).

Helper: `isBillSettled` + `isBillPayment` em `creditBillPeriod.js`. Perfil: `itau` em `profiles.js`.

## Parcelas

1. POSTED com `billId` → índice pelo `dueDate` da fatura oficial.
2. PENDING futuras **sem** `billId`: `dueMonthFromInstallmentSeries` ancora em uma parcela irmã já postada (`N` → `due + (n−N)`). Sem isso, um offset global 1 empurra `02/06` / `05/10` para o mês seguinte ao correto.
3. Perfil usa `forecastToDueOffset: 0` (o que importa sem `billId` já vem com fc = due).
4. Projetar só parcelas que a Pluggy ainda não enviou (`hasInstallmentNumber`).

## Exemplo validado (Jesse, ago/2026)

- Cartão **Itau Uniclass Visa Signature** final 7823
- Fatura oficial venc. `2026-08-10`, total **R$ 142,93**
- `payments[]`: `[{ paymentDate: 2026-07-10, amount: 252.87 }]` ← total da fatura de **julho**
- Tx `2026-08-10` · `Pagamento PIX` · **-142.93** · `billForecastDate: 2026-08`
- Compras: `PREV MED 01/06`, `JE TURISMO 04/10`, `ITAUSHOP 16/18`
- PENDING: `PREV MED 02/06` e `JE TURISMO 05/10` com `fc: 2026-09` → devem cair na fatura **set/2026** (venc. 10/09), não out/2026
- `ITAUSHOP 17/18` ausente na Pluggy → projetar para set/2026

## Armadilhas

- Confiar em `paid >= total` em `payments[]` → todas as faturas oficiais “pagas”, fatura aberta no mês seguinte **vazia**.
- Forçar offset forecast→due = 1 globalmente → parcelas PENDING futuras (fc = due) vão para **due+1** e somem da fatura do mês seguinte.
- Cartões satélite com limite R$ 200 e 0 lançamentos (`ITAU MULTIPLO…` 7522 / 9772) não são o cartão principal — usar o Uniclass com movimento.
