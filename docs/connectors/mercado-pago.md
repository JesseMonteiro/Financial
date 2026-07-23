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
