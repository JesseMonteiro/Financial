# Banco Inter — guia de codificação (Pluggy)

## Identificação

- Connector / institution contendo `Inter`
- No app FinanceHub o cartão pode ter nome customizado (ex.: **Inter Prime**); o `account.name` da Pluggy pode ser só o titular (`JESSE M FERREIRA`) + final do cartão

## Campos

| Campo Pluggy | Semântica Inter |
|--------------|-----------------|
| `bill.dueDate` | Dia 12 (comum no Inter) |
| `bill.payments[]` | **Frequentemente vazio** mesmo com fatura paga no app |
| `account.balance` | Dívida total ≈ `creditLimit − availableCreditLimit` |
| Pagamento | Lançamento `PAGAMENTO ON LINE` / `Pagamento recebido` (POSTED) e, no débito automático, `PAGTO DEBITO AUTOMATICO` (muitas vezes **PENDING** com o mesmo valor) |
| `billId` no pagamento | Costuma apontar para a fatura **seguinte** (mesmo padrão Nubank) |

## Liquidação

1. **Não** confiar só em `payments[]` — no Inter OF costuma vir `[]`.
2. Considerar liquidada se existir tx `PAGAMENTO ON LINE` (ou similar) com `|amount| ≈ totalAmount` e data ≥ `dueDate`, ou `billId` no ciclo seguinte.
3. Helper: `isBillPayment` + `isBillSettled` em `creditBillPeriod.js`.

## Exemplo validado (Jesse, jul/2026)

- Fatura oficial venc. `2026-07-12`, total **R$ 1.502,41**, `payments: []`
- Tx `2026-07-13` · `PAGAMENTO ON LINE` · **-1502.41** · `billId` da fatura de agosto
- Sem reconhecer essa descrição → UI mostrava **Pendente** / não paga

## Armadilhas

- Momento Financeiro usando só `payments.length > 0` → sempre pendente no Inter.
- Não tratar `PAGAMENTO ON LINE` / `PAGTO DEBITO AUTOMATICO` como pagamento → o CREDIT (−total da fatura paga) entra no `signed_net` da fatura **aberta** e derruba o total (ex.: set/2026 ~R$ 6.114 vira ~R$ 750).
- `PAGTO DEBITO AUTOMATICO` PENDING costuma coexistir com `Pagamento recebido` POSTED do mesmo valor — ambos precisam de `isBillPayment`.
- PENDING sem `billId` com `billForecastDate` velho: o remap `after_cycle_end` manda para a fatura **aberta**. Se a **data da compra** for depois do vencimento dessa fatura (ex.: compra em 04/09 com aberta venc. 07/08), deve ir para o ciclo seguinte — `advanceDueMonthPastPurchaseDate` em `creditBillPeriod.js`.
- **`date` em PENDING parcelado ≠ data da compra.** Inter manda a data **prevista do lançamento da parcela** (pode ser futuro). Ex.: `99PAY` R$ 5,70 com `date: 2026-09-04`, `installmentNumber: 2`, `totalInstallments: 2`, `billId` da fatura de set/2026. Sem badge de parcela na UI parece compra à vista no futuro. Ordenar/exibir com `resolvePurchaseDate` (usa `purchaseDate` ou `date − (N−1)` meses).
- **`redistributeStackedInstallments`**: não mover txs com `billId` oficial resolvido; senão várias compras iguais (mesmo merchant + N/M) viram uma série só e parcelas caem na fatura errada.
- Inter já devolve **faturas oficiais futuras** (set→mai) com `totalAmount` projetado — indexar por `bill.dueDate` / `billId`, não pelo `date` da parcela. **Não** somar parcelas `isProjected` em cima do `totalAmount` oficial (`includeProjectedInOfficialTotal: false`).
- **`totalAmount` oficial curto**: a Pluggy pode omitir um lançamento que já tem `billId` da fatura aberta (Jesse out/2026: oficial **R$ 729,86**, faltava `BRISANET*INTERNET` **R$ 70,42**; app **R$ 800,28**). Com `liftOfficialToCycleCharges`, sobe para a soma com sinal do ciclo.
- **Drift da parcela 1**: PIX 12× pode nascer com R$ 271,22 e as demais com R$ 271,11. A chave da série arredonda a R$ 0,10 e trata como duas compras. Sem `hasSimilarInstallment` ≥ R$ 0,20, o app projeta 11/12 e 12/12 fantasma na fatura aberta (Jesse set/2026: oficial R$ 929,29 + R$ 501,21 = **R$ 1.430,50** vs PDF **R$ 951,74**).
