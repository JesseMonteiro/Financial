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
| Pagamento | Lançamento `PAGAMENTO ON LINE` (valor **negativo**, igual ao `totalAmount` da fatura paga) |
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
- Não tratar `PAGAMENTO ON LINE` como pagamento → valor entra na soma do ciclo seguinte (infla fatura aberta).
