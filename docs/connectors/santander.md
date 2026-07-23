# Santander — guia de codificação (Pluggy)

## Identificação

- Connector / conta contendo `Santander`

## Campos

| Campo Pluggy | Semântica típica |
|--------------|------------------|
| `billForecastDate` | Mês **anterior** ao vencimento (offset **1**) |
| `billClosingDate` vs `dueDate` | Fechamento no mês anterior ao due |
| Total aberto | Soma do ciclo; validar se `balance` coincide com a aberta antes de confiar |

## Regras

1. `getDueMonthKey`: `ymAdd(billForecastDate, 1)` quando offset inferido/perfil = 1.
2. Compras sem forecast: `ymAdd(purchaseMonth, 1)` como fallback.
3. Não assumir pagamento no ciclo seguinte — checar `bill.payments[]` primeiro.

## Armadilhas

- Aplicar offset 0 (Nubank) em Santander desloca a fatura aberta um mês para trás.
- Inferir offset só com poucas amostras; preferir perfil `santander` + confirmação por pares billId.
- Pluggy pode enviar **várias parcelas futuras** (`2/12`, `3/12`, …) com o **mesmo** `billForecastDate` do ciclo aberto. Sem redistribuir, o total da fatura aberta vira a dívida de todos os meses. A função `redistributeStackedInstallments` espalha por número da parcela.
