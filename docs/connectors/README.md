# Guias de codificação — cartões de crédito (Pluggy)

Cada banco envia metadados de fatura de forma diferente. A lógica canônica vive em:

- `src/utils/creditBillPeriod.js` — buckets por **mês de vencimento**, totais, parcelas
- `src/utils/creditConnectors/profiles.js` — perfis machine-readable por conector

## Regras gerais (todos os bancos)

1. **Indexar por due month** (`YYYY-MM` de `bill.dueDate`), nunca pelo mês civil da compra.
2. **`billForecastDate` ≠ due month** em alguns conectores — usar `inferForecastToDueOffset` ou o offset do perfil.
3. **`account.balance` em cartão** muitas vezes é **dívida total** (`creditLimit − availableCreditLimit`), **não** o valor da fatura aberta. Preferir soma dos lançamentos do ciclo aberto.
4. **Pagamento** pode aparecer na fatura **seguinte** (Nubank) ou em `bill.payments[]` da fatura paga.
5. **Parcelas**: Pluggy pode enviar as próximas como `PENDING` **e** omitir algumas. Projetar só o que falta; nunca duplicar `N/M` já presente. Se várias parcelas da mesma série vierem com o **mesmo** `billForecastDate`, redistribuir (`redistributeStackedInstallments`) para não somar todos os meses na fatura aberta.
6. Fatura **oficial liquidada** (`payments[]` ou pagamento no ciclo seguinte) nunca é `CURRENT_OPEN`.
7. **Telegram `/faturas`**: usar `summarizeCardOpenBill` → total do ciclo aberto, **nunca** `account.balance` (dívida total).
8. **PENDING sem `billId` em ciclo já oficial**: só remapeia para a fatura aberta se a **data da compra** for **depois** do fechamento (`billClosingDate` / `dueDate`) da última fatura oficial. Conectores como Carrefour deixam compras antigas como `PENDING` para sempre — remapar tudo infla a fatura aberta com o ledger histórico.

## Conectores documentados

| Perfil | Guia | Offset forecast→due | Balance típico | Total fatura aberta | Remap PENDING stale |
|--------|------|---------------------|----------------|---------------------|---------------------|
| Nubank | [nubank.md](./nubank.md) | 0 | Dívida total | Soma **com sinal** do ciclo | após fechamento |
| Carrefour | (perfil em `profiles.js`) | inferir | Dívida total | Soma com sinal | após fechamento (nunca dump histórico) |
| Mercado Pago | [mercado-pago.md](./mercado-pago.md) | 0 | Dívida total | Soma com sinal | após fechamento |
| Santander | [santander.md](./santander.md) | 1 | Variável | Soma com sinal | após fechamento |
| Inter | [inter.md](./inter.md) | 0 | Dívida total | Soma com sinal (`payments[]` costuma vazio) | após fechamento |
| MeuPluggy | [meupluggy.md](./meupluggy.md) | inferir | Dívida total (sandbox) | Soma com sinal | após fechamento |

Ao conectar um banco novo: copiar o template de `nubank.md`, registrar o perfil em `profiles.js` (`chargeSumMode`, `remapStalePending`), e validar com 1 ciclo fechado + 1 aberto contra o app do banco.
