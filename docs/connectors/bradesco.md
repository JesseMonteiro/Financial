# Bradesco / Amazon (Bradescard) — guia de codificação (Pluggy)

## Identificação

- Nome do cartão / marketing contendo `Amazon`
- Connector ou instituição contendo `Bradesco` / `Bradescard`

## Campos

| Campo Pluggy | Semântica típica |
|--------------|------------------|
| `billForecastDate` | Muitas vezes o **mês de fechamento** (offset 1 vs due). Inferir por pares `billId` / close vs due |
| `bill.dueDate` | Dia 5 do mês seguinte ao fechamento (~dia 21) |
| `bill.totalAmount` | Pode vir **incompleto** — draft aberto só com compras novas, ou fatura já fechada ainda abaixo do PDF |
| `account.balance` | **Dívida total** ≈ `creditLimit − availableCreditLimit` — **não** usar como total da fatura |

## Ciclo e total

1. Total = `totalAmount` oficial + parcelas `isProjected` no bucket do vencimento.
2. Se a soma com sinal dos lançamentos do ciclo for **maior** (`liftOfficialToCycleCharges`), usar essa soma. Caso validado (Lucas, Amazon, venc. 05/09/2026): PDF **R$ 1.602,24**; Pluggy oficial **R$ 1.532,54** (faltavam R$ 69,70 que já estavam nos txs do ciclo).
3. Créditos/estornos (ex.: compra + estorno no mesmo dia) entram como `CREDIT` e reduzem o total (`signed_net`). Pagamento (`PAGAMENTO RECEBIDO`) não entra na soma.
4. Após o fechamento, o conector pode manter o ciclo fechado como `PENDING` sem `billId` e já marcar compras novas no forecast seguinte — ver regra 10 do README.

## Armadilhas

- Confiar só no `totalAmount` oficial depois do fechamento → fatura menor que o PDF do banco.
- Usar `account.balance` como fatura aberta → infla com o parcelado futuro (limite − disponível).
- Somar `Math.abs` → estornos (CREDIT) viram débito extra.
