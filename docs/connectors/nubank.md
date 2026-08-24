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
3. Total aberto = **soma com sinal** dos itens do ciclo (`chargeSumMode: signed_net`), excluindo `Pagamento recebido`. Não usar `Σ |amount|` — o Nubank posta pares que se cancelam (`Saldo em atraso` DEBIT + `Crédito de atraso` CREDIT, `Juros` + `Encerramento de dívida`).
4. Exemplo validado (Jesse, ago/2026): app Nubank **R$ 226,71**; `Σ |amount|` dava **R$ 986,30**; signed net ≈ **R$ 226,72**.

## Parcelas

- Parcelas seguintes costumam vir como `PENDING` com `installmentNumber/totalInstallments`.
- Se faltar uma (ex.: Samsung 20/24 ausente mas 19/24 POSTED), **projetar** a partir da maior parcela vista.
- Pluggy também pode **pular o meio da série** (ex.: Globoplay 4/12 e 7/12 sem 5–6). Preencher o buraco relativo à maior parcela conhecida e só nos ciclos ≥ aberto — caso validado (Lucas, set/2026): sem a 6/12 projetada a aberta ficava **R$ 468,18**; com ela **R$ 513,08** (= app).
- Não projetar `N/M` se já existir transação real com o mesmo `N/M`.

## Armadilhas

- Mostrar fatura oficial paga como “Em Aberto” porque ainda há `PENDING` com forecast no mês pago.
- Usar `balance` como total da aberta → valores inflados (dívida de todas as parcelas restantes).
- Duplicar parcela real + projetada na mesma fatura.
- Somar `Math.abs` de todos os lançamentos → infla com créditos de atraso / encerramento de dívida.
