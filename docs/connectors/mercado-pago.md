# Mercado Pago — guia de codificação (Pluggy)

## Identificação

- Nome da conta / connector contendo `Mercado Pago` / `MercadoPago`

## Campos

| Campo Pluggy | Semântica |
|--------------|-----------|
| `billForecastDate` | Em geral **mesmo mês** do vencimento (offset **0**) |
| `account.balance` | Tratar como **dívida total** até prova em contrário |
| Fatura aberta | Soma dos lançamentos do ciclo (`cycle_charges`) |

## Regras

1. Mesma pipeline Nubank-like: due-month indexing, não reabrir ciclo oficial pago.
2. Validar offset com pares `billForecastDate` + `billId` antes de hardcodar.
3. Parcelas: deduplicar real vs projetada.

## Armadilhas

- Consolidar “todos os cartões” misturando open-key pelo **mínimo** entre contas — preferir totais **por cartão** na UI consolidada.
- **Cartões adicionais**: Pluggy pode omitir lançamentos de adicionais em `/transactions` enquanto `account.balance` já os inclui. Com `reconcileOpenWithBalance`, a fatura aberta = `balance − PENDING(futuro) − PENDING(passado não pago)` quando isso for maior que a soma dos itens listados.
- **Compra em dólar**: `amount` vem em USD e o valor na fatura está em `amountInAccountCurrency` (BRL). Sempre usar `txBillingAmount` / `signedTxAmount` — ex.: CURSOR `amount: 20` + `currencyCode: USD` + `amountInAccountCurrency: 107.02`.
- Parcelas longas (`18/18`): o conector manda todas as parcelas futuras como `PENDING` com `billForecastDate` distintos — não somar na aberta; só a parcela do ciclo atual.
