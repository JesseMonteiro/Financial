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
2. Se a soma com sinal dos lançamentos do ciclo for **maior** (`liftOfficialToCycleCharges`), usar essa soma.
3. Créditos/estornos (ex.: compra + estorno no mesmo dia) entram como `CREDIT` e reduzem o total (`signed_net`). Pagamento (`PAGAMENTO RECEBIDO`) não entra na soma.
4. Após o fechamento, o conector pode **não publicar** a fatura oficial (Lucas, Amazon, venc. 05/09/2026: só existia a de 05/08). PENDING de parcelas vem com `billForecastDate` do mês de fechamento **anterior** e `dueMonthFromInstallmentSeries` ancora em `billId` antigo → parcela atual some no ciclo pago. Não aplicar series-due no passado; `slideProjectionToOpen` + `projectionAnchorDue` deslizam N+1 para a fatura aberta (**só neste perfil** — no Nubank o mesmo gap é normal e o slide infla a aberta). Caso validado: PDF **R$ 1.602,24** vs soma sem o slide **R$ 1.532,54** (faltavam R$ 69,70 de parcelas finais). **Não** deslizar parcela cujo vencimento natural já tem fatura oficial **liquidada** (Jesse, out/2026: 1/2 em ago → fantasma 2/2 na aberta; PDF **R$ 627,10** vs **R$ 662,43**).

## Armadilhas

- Confiar só no `totalAmount` oficial depois do fechamento → fatura menor que o PDF do banco.
- Ancorar PENDING `N/M` sem `billId` em parcelas postadas antigas → a parcela da fatura aberta é projetada para um ciclo já pago e descartada (`futureDue < open`).
- Drift de valor na chave da série (121,50 vs 121,42; 10,07 vs 9,99) → duas séries gêmeas projetam N e N+1 na aberta (+R$ 121,16). Colapsar só gêmeos reais com `collapseDriftedInstallmentSeries` / `installmentSeriesAreAmountDriftTwins` e bloquear com `monthHasSimilarCharge` (Lucas Amazon out/2026: PDF **R$ 3.119,34** vs **R$ 3.240,50**). Não colapsar compras distintas ~mesmo valor (10,51 4/4 vs 10,62 1/4) — isso remove a parcela aberta (~R$ 10,59) e fica abaixo do PDF.
- `slideProjectionToOpen` atravessar uma fatura oficial **já liquidada** → ressuscita parcelas (ex.: 2/2 de R$ 10,62) na aberta e infla o total (PDF R$ 627,10 vs R$ 662,43).
- `hasSimilarInstallment` casar só por valor ±R$ 0,50 (sem prefixo do lojista) → parcelas ~R$ 10 de compras diferentes (Carrefour vs Ferreira Costa) se bloqueiam e somem da aberta. Mesmo com prefixo, ±R$ 0,20 une Amazon 4× distintas (10,62 vs 10,51) e impede a 3/4 da aberta — tolerância relativa ~1% (teto R$ 0,20).
- Usar `account.balance` como fatura aberta → infla com o parcelado futuro (limite − disponível).
- Somar `Math.abs` → estornos (CREDIT) viram débito extra.
- Projetar o restante inteiro de um `1/N` que ainda é **PENDING** (nunca POSTED): o app do Bradesco só estende esses planos até a aberta + 1 fatura. `capUnpostedSeriesHorizon` corta o resto (Jesse nov/2026: 1/3 de R$ 53,36 na aberta gerava +R$ 53,36 em nov; luvincome 1/7 e marilene 1/5 na fatura fechada geravam +R$ 32,72 em dez → **203,33 vs 149,90** e **162,87 vs 76,89**). Séries com histórico POSTED continuam projetadas até o fim.
