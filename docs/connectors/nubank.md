# Nubank — guia de codificação (Pluggy)

## Identificação

- Connector name / institution contendo `Nubank` / `Nu Pagamentos`
- Em sandbox MeuPluggy o cartão pode vir só como `platinum` — o perfil `meupluggy` cobre o comportamento

## Campos

| Campo Pluggy | Semântica Nubank |
|--------------|------------------|
| `billForecastDate` | Mesmo mês do vencimento (offset **0**) |
| `bill.dueDate` | Dia de vencimento (ex.: 09 ou 12) |
| `bill.payments[]` | Pagamento daquela fatura (FULL_PAYMENT) |
| `account.balance` | **Dívida total** ≈ `creditLimit − availableCreditLimit` — **não** usar como total da fatura aberta |
| `status: PENDING` | Lançamentos da fatura ainda não fechada (+ parcelas futuras já agendadas) |
| `Pagamento recebido` | Crédito; na fatura aberta aparece o pagamento da fatura **anterior** |

## Ciclo aberto

1. Última fatura oficial com `payments[]` cobrindo o total → ciclo **fechado/pago**.
2. Aberto = mês seguinte ao último `dueDate` oficial, ou `PENDING` com `billForecastDate` **depois** desse mês.
3. Total aberto = Σ \|amount\| dos itens do ciclo (`!pagamento`, incluir parcelas projetadas **faltantes**).
4. Exemplo validado (Lucas, jul/2026): app Nubank **R$ 295,79**; Pluggy `balance` era **R$ 1.232,29** (dívida total).

## Parcelas

- Parcelas seguintes costumam vir como `PENDING` com `installmentNumber/totalInstallments`.
- Se faltar uma (ex.: Samsung 20/24 ausente mas 19/24 POSTED), **projetar** a partir da maior parcela vista.
- Não projetar `N/M` se já existir transação real com o mesmo `N/M`.

## Armadilhas

- Mostrar fatura oficial paga como “Em Aberto” porque ainda há `PENDING` com forecast no mês pago.
- Usar `balance` como total da aberta → valores inflados (dívida de todas as parcelas restantes).
- Duplicar parcela real + projetada na mesma fatura.
