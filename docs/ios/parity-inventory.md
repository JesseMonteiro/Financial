# iOS feature parity inventory

Source of truth for web ↔ iOS parity. Every web route in [`src/App.jsx`](../../src/App.jsx) and nav entry in [`src/components/layout/navItems.js`](../../src/components/layout/navItems.js) must map to a native screen/module before GA.

**Status legend:** `⬜` not started · `🟡` in progress · `✅` done · `🚫` out of scope (documented)

**Global DoD (every feature):** loading · empty · error · offline · a11y · telemetry · unit/contract/UI tests · iPhone + iPad acceptance. A feature is not ✅ until all acceptance criteria below pass.

---

## Shell & session

| Web route / area | Web source | iOS module | iOS screen(s) | Status |
| --- | --- | --- | --- | --- |
| `/login` (login / signup / reset) | `Login.jsx` | `Authentication` | `AuthenticationView` (3 modos) | 🟡 |
| Session restore / splash | `authStore` + `AuthGuard` | `Authentication` + `FinancialApp` | `RootView` + Keychain | 🟡 |
| App shell (tabs / sidebar / More) | `MainLayout.jsx`, `LiquidGlassTabBar.jsx` | `FinancialApp` + `FinancialDesignSystem` | `AdaptiveShell`, `MoreMenuView` | 🟡 |
| Global search | Header search | `FinancialApp` | `GlobalSearchView` | ⬜ |
| Deep links / universal links | Router paths | `FinancialApp` | `AppRoute.fromDeepLink` | 🟡 |

### Acceptance — shell & session

| State | Criteria |
| --- | --- |
| Loading | Splash shows until Keychain session restore finishes; no flash of login when session is valid. |
| Empty | First launch with no session lands on login; after login with no banks, empty dashboard with CTA to connect or add manual account. |
| Error | Invalid credentials, network failure, and expired refresh show actionable errors; 401 triggers re-auth without crashing. |
| Offline | Cached session still unlocks shell; network-required actions show offline banner and disable Connect/PDF/joint invite. |
| A11y | Login fields labeled; errors announced; Dynamic Type; Reduce Motion on splash; Face ID optional does not block VoiceOver path. |

---

## Primary product routes (19 areas)

| # | Web path | Label | Web page | iOS feature module | Primary screen | Status |
| --- | ---: | --- | --- | --- | --- | --- |
| 1 | `/` | Visão Geral | `Dashboard.jsx` | `Dashboard` | `DashboardView` | 🟡 |
| 2 | `/accounts` | Contas & Saldos | `Accounts.jsx` | `Accounts` | `AccountsView` (lista, rename, conta manual) | 🟡 |
| 3 | `/transactions` | Transações | `Transactions.jsx` | `Transactions` | `TransactionsView` (busca, filtros, CSV) | 🟡 |
| 4 | `/investments` | Investimentos | `Investments.jsx` | `Investments` | `InvestmentsView` (Pluggy + conjunto) | 🟡 |
| 5 | `/credit-cards` | Cartões de Crédito | `CreditCards.jsx` | `CreditCards` | `CreditCardsView` + compra + parse-bill | 🟡 |
| 6 | `/loans` | Empréstimos | `Loans.jsx` | `Loans` | `LoansView` | 🟡 |
| 7 | `/budget` | Orçamento | `Budget.jsx` | `Budget` | `BudgetView` CRUD `/v1/domain/budgets` | 🟡 |
| 8 | `/receivables` | Valores a Receber | `Receivables.jsx` | `Receivables` | `ReceivablesView` CRUD | 🟡 |
| 9 | `/financial-moment` | Momento Financeiro | `FinancialMoment.jsx` | `FinancialMoment` | `FinancialMomentView` + CTA despesa | 🟡 |
| 10 | `/joint-account` | Conta conjunta | `JointFinancialMoment.jsx` | `JointFinance` | `JointFinanceView` + investimentos | 🟡 |
| 11 | `/manual-expenses` | Despesas Manuais | `ManualExpenses.jsx` | `ManualExpenses` | `ManualExpensesView` CRUD | 🟡 |
| 12 | `/subscriptions` | Assinaturas | `Subscriptions.jsx` | `Subscriptions` | `SubscriptionsView` (derivado no cliente) | 🟡 |
| 13 | `/agenda` (`/calendar` → redirect) | Agenda | `Agenda.jsx` | `Agenda` | `AgendaView` (derivado no cliente) | 🟡 |
| 14 | `/goals` | Metas | `Goals.jsx` | `Goals` | `GoalsView` CRUD `/v1/domain/goals` | 🟡 |
| 19 | `/meal-vouchers` | VA / VR | `MealVouchers.jsx` | `MealVouchers` | `MealVouchersView` CRUD `/v1/domain/meal-benefits` | 🟡 |
| 15 | `/reports` | Relatórios | `Reports.jsx` | `Reports` | `ReportsView` + CSV | 🟡 |
| 16 | `/connect` | Conexões Bancárias | `ConnectBank.jsx` | `BankConnections` | lista, sync, Pluggy Connect WKWebView | 🟡 |
| 17 | `/settings` | Configurações | `Settings.jsx` | `Settings` | tema, Telegram, logout; export/delete 🚫 web | 🟡 |
| 18 | Auth / onboarding (non-nav) | Sessão | `Login.jsx` | `Authentication` | (see Shell) | 🟡 |

**Conditional nav:** Conta conjunta (`requiresJoint: true`) appears only when joint link is active — same rule as `getVisibleNavItems`.

**Mobile tabs (parity with `mobileTabPaths`):** Início · Transações · Cartões · Momento · Mais.

---

## Feature-level parity checklists

### 1. Dashboard (`/`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Net worth, account balance, savings rate | ✅ | `DashboardView` metrics | ⬜ |
| Spend vs previous month + sparklines | ✅ | Swift Charts | ⬜ |
| Category expenses, income vs expense | ✅ | Charts + drill-down | ⬜ |
| Insights / weekly recap | ✅ | Insight cards | ⬜ |
| Latest transactions, budget summary | ✅ | Sections + nav | ⬜ |
| Shortcuts (agenda, investments, credit, connect) | ✅ | Deep links | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | Independent skeletons per card; no fabricated totals. |
| Empty | Zero accounts → guided empty with connect / manual CTA. |
| Error | Partial section failure isolates error; other cards still render. |
| Offline | Stale-while-revalidate snapshot + “Atualizado em”; no silent zeros. |
| A11y | Metrics as accessibility values; charts have tabular/VO alternative. |

### 2. Accounts (`/accounts`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| List by bank/type with balance/bill | ✅ | `AccountsListView` | ⬜ |
| Rename, icon/photo, custom face | ✅ | Editors + upload via BFF | ⬜ |
| Manual account/card CRUD + bill amount | ✅ | Domain CRUD `/v1/manual-accounts` | ⬜ |
| Delete manual; add purchase | ✅ | Same | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | List skeleton; detail skeleton. |
| Empty | No Pluggy/manual → empty with dual CTA. |
| Error | Sync/ownership errors per item; IDOR never leaks other users. |
| Offline | Read cached balances; mutate only local-safe manual edits queued. |
| A11y | Account rows announce name, type, balance; icons decorative or labeled. |

### 3. Transactions (`/transactions`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Debounced search | ✅ | Search field | ⬜ |
| Filters: account/type/category/period/status | ✅ | Filter sheet | ⬜ |
| Incremental pagination + refresh | ✅ | Lazy list | ⬜ |
| Detail + CSV export | ✅ | Detail + `ShareLink` | ⬜ |
| Pluggy read-only vs manual editable | ✅ | Clear badges | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | First page skeleton; append spinner for next page. |
| Empty | No matches vs no data distinguished. |
| Error | Retry on page load; failed export shows toast. |
| Offline | Cached pages readable; export disabled if incomplete. |
| A11y | Filters announced; amount polarity not color-only. |

### 4. Investments (`/investments`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Portfolio total, allocation, issuers, instruments | ✅ | `InvestmentsView` | ⬜ |
| Personal / joint toggle | ✅ | Uses joint investments when linked | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | Portfolio skeleton. |
| Empty | No investments copy + connect CTA. |
| Error | Pluggy/BFF error with retry. |
| Offline | Cached snapshot only. |
| A11y | Allocation chart + table alternative. |

### 5. Credit cards (`/credit-cards`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Card selector + custom face | ✅ | Shared geometry transition | ⬜ |
| Open / last paid / debt / limit KPIs | ✅ | Never confuse `balance` with open bill | ⬜ |
| Due-month timeline, statement, installments, payments, USD | ✅ | Bill buckets from BFF + fixtures | ⬜ |
| Manual purchase + PDF parse review | ✅ | `fileImporter` + `/v1/parse-bill` | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | Card carousel + KPI skeletons. |
| Empty | No credit accounts → empty CTA. |
| Error | Connector/profile mismatch surfaced; partial bills don’t invent open total. |
| Offline | Last summary readable; PDF/parse requires network. |
| A11y | Card faces labeled; installments N/M announced. |

### 6. Loans (`/loans`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Balance, installments, progress, detail | ✅ | List + detail | ⬜ |

| State | Criteria |
| --- | --- |
| Loading / empty / error / offline / a11y | Same pattern as investments; progress not color-only. |

### 7. Budget (`/budget`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Month strip, KPIs, real vs limit, refunds, overspent | ✅ | `BudgetView` | ⬜ |
| CRUD category limits | ✅ | `/v1/budgets` | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | Month + category skeletons. |
| Empty | No limits → prompt to create. |
| Error | Save failures keep previous values. |
| Offline | Read cached; writes queued with conflict UI. |
| A11y | Progress bars have numeric labels. |

### 8. Receivables (`/receivables`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| KPIs, group by person, one-off/card, installment/continuous | ✅ | List + editor | ⬜ |
| Mark installment received | ✅ | Toggle + undo | ⬜ |

| State | Criteria |
| --- | --- |
| Loading / empty / error / offline / a11y | Full CRUD states; received toggle VoiceOver. |

### 9. Financial moment (`/financial-moment`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| 12-month strip, salary, in/out/to-pay/residual/utilization | ✅ | `FinancialMomentView` | ⬜ |
| Refunds, bills, auto-debits, manuals + paid toggles | ✅ | Sections + navigation to source | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | Strip + section skeletons. |
| Empty | No data for month shows zeros honestly + add expense CTA. |
| Error | Calculation version mismatch banner if client/server diverge. |
| Offline | Cached month; salary edits queued. |
| A11y | Month strip as adjustable; paid toggles labeled. |

### 10. Joint account (`/joint-account`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Invite (6-digit), accept, unlink | ✅ | Settings + joint module | ⬜ |
| Aggregated moment + investments | ✅ | Owner badges | ⬜ |
| Paid/restore manual across members | ✅ | Authorized BFF only | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | Link status fetch before content. |
| Empty | Not linked → invite/accept only (nav hidden). |
| Error | Invalid/expired code; unauthorized cross-user → 403. |
| Offline | Status may be stale; invite/accept/unlink require network. |
| A11y | Partner identity clear; destructive unlink confirmation. |

### 11. Manual expenses (`/manual-expenses`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| CRUD, recurrence continuous/installment, series edit, paid + undo | ✅ | Full editor | ⬜ |
| Deep link with preselected account | ✅ | Route query parity | ⬜ |

| State | Criteria |
| --- | --- |
| Loading / empty / error / offline / a11y | Offline queue for safe writes; series expand announced. |

### 12. Subscriptions (`/subscriptions`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Auto-detect merchants, monthly total, confidence, jump to txs | ✅ | Detection from cached txs / BFF | ⬜ |

| State | Criteria |
| --- | --- |
| Loading / empty / error / offline / a11y | Empty = no recurring pattern; confidence not color-only. |

### 13. Agenda (`/agenda`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| KPIs, filters, month strip, calendar, day detail, paid toggle | ✅ | Calendar + list | ⬜ |

| State | Criteria |
| --- | --- |
| Loading / empty / error / offline / a11y | Calendar VO summary; overdue vs paid clear. |

### 14. Goals (`/goals`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| CRUD target/saved/deadline, progress vs expected, projection | ✅ | List + editor | ⬜ |

| State | Criteria |
| --- | --- |
| Loading / empty / error / offline / a11y | Progress numeric; offline queue writes. |

### 15. Reports (`/reports`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| 3/6/12 months, account filter, overview/trends/Sankey | ✅ | Swift Charts + optional Sankey | ⬜ |
| CSV / PDF export | ✅ | Share sheet | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | Chart placeholders. |
| Empty | Insufficient history message. |
| Error | Export failure recoverable. |
| Offline | Cached period only; export may be limited. |
| A11y | Sankey has tabular alternative always. |

### 16. Bank connections (`/connect`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Connect token, Pluggy Connect session, register, poll | ✅ | Official Pluggy iOS path | ⬜ |
| Sync item/global, MFA/update, reconnect, delete | ✅ | Item actions | ⬜ |
| Webhooks list/register/delete/history (advanced) | ✅ | Admin subsection | ⬜ |

| State | Criteria |
| --- | --- |
| Loading | Connect + item status polling with cancel. |
| Empty | No items → connect CTA. |
| Error | `LOGIN_ERROR`, timeout, MFA required states explicit. |
| Offline | Connect/sync blocked with banner. |
| A11y | Status chips labeled; destructive delete confirmed. |

### 17. Settings (`/settings`)

| Capability | Web | iOS | Status |
| --- | --- | --- | --- |
| Profile, theme, primary color, density, animations | ✅ | Appearance section | ⬜ |
| Telegram link-token / disconnect | ✅ | `/v1/chatbot/telegram/link-token` | ⬜ |
| Joint invite/accept/unlink | ✅ | Shared with JointFinance | ⬜ |
| Privacy, export/delete data, terms, version, logout | ✅ | Privacy + destructive logout clears Keychain/SwiftData | ⬜ |
| Pluggy credentials | Server-side only on iOS | Status display only (no secrets) | ⬜ |

| State | Criteria |
| --- | --- |
| Loading / empty / error / offline / a11y | System a11y prefs override in-app animation; logout clears local data. |

---

## Native-only (beyond web parity)

| Capability | Module | Notes | Status |
| --- | --- | --- | --- |
| APNs (due dates, sync action, joint invite) | `FinancialApp` | Granular prefs | ⬜ |
| Widgets (net worth, bill, dues) | `FinancialWidgets` | Redacted when locked | ⬜ |
| App Intents / Shortcuts | Features | Confirm for money actions | ⬜ |
| Face ID / Touch ID lock | `Authentication` | Does not replace remote auth | ⬜ |
| Spotlight / Quick Actions | `FinancialApp` | Feature shortcuts | ⬜ |
| Apple Pay / payment initiation | — | 🚫 Aggregator only | 🚫 |

---

## Cross-cutting acceptance matrix

Use this matrix when signing a feature ✅.

| Concern | Pass condition |
| --- | --- |
| Loading | Skeletons or progress; no misleading totals during partial load. |
| Empty | Distinct copy + primary CTA; never blank white. |
| Error | Typed error + retry/dismiss; correlation ID in diagnostics (not UI PII). |
| Offline | Banner; read cache; unsafe mutations disabled or queued with conflict UX. |
| A11y | VoiceOver labels, Dynamic Type, Reduce Motion/Transparency, contrast, 44pt targets. |
| Money | `Decimal`/`Money`; string decimals from API; BRL default. |
| Security | No service secrets on device; Keychain session; logout wipe. |
| Calculation | Shared fixtures pass; `calculationVersion` matches BFF. |
| Devices | Accepted on iPhone and iPad (split view where applicable). |

---

## Sign-off

| Gate | Owner | Date | Notes |
| --- | --- | --- | --- |
| Inventory approved | | | Phase 1 — contracts |
| Vertical slice (Dashboard/Accounts/Transactions) | | | |
| Credit + Moment + Joint fixtures | | | |
| Full 18-route parity | | | Pre-GA |
| A11y + performance budgets | | | |
