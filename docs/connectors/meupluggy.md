# MeuPluggy (sandbox) — guia de codificação

## Identificação

- `connectorId === 200` ou nome `MeuPluggy`

## Comportamento observado

O sandbox replica fixtures de vários bancos sob o mesmo connector:

| Conta exemplo | Comportamento |
|---------------|---------------|
| `platinum` (Nubank-like) | offset 0; `balance` = dívida total; `PENDING` com `billForecastDate` no mês de due da aberta |
| `Mercado Pago` | offset 0 |
| `AMAZON MASTERCARD PLATINUM` (Bradesco-like) | offset 1 (`forecast` = mês de fechamento); após fechar, ciclo fica `PENDING` sem `billId` e **compras novas** (parcela 1 / à vista) já vêm com o próximo forecast — ver regra 10 do README |
| Outros cartões sandbox | Inferir offset pelos dados |

## Regras de código

1. Perfil `meupluggy`: `forecastToDueOffset: null` (inferir), `openTotalSource: 'cycle_charges'`.
2. Se `balance ≈ creditLimit − availableCreditLimit`, **nunca** usar balance como total da fatura aberta.
3. API de transações: usar **`GET /v2/transactions`** com cursor (`next`); `/transactions` v1 retorna **410**.
4. Cartão Amazon no sandbox: o perfil **bradesco** ganha pelo nome da conta. Sem fatura oficial do ciclo aberto, aplicar `slideProjectionToOpen` (ver [bradesco.md](./bradesco.md)). Não aplicar no platinum Nubank-like.

## Validação

Sempre cruzar 1 fatura fechada + 1 aberta com o app real do banco correspondente à fixture — o nome da conta no sandbox pode não citar o banco.
