/**
 * Re-exports Pluggy resource handlers for /v1 and legacy callers.
 * Additional domain/telegram handlers may be extracted here later.
 */
export {
  PLUGGY_API,
  asItemIdList,
  getPluggyApiKey,
  pluggyFetch,
  pluggyJson,
  resolvePluggyItemId,
  ownedItemIds,
  handleAccounts,
  handleTransactions,
  handleCategories,
  handleInvestments,
  handleLoans,
  handleBills,
  handleConnectors,
  handleItems,
  handleWebhooks,
  type PluggyClient,
} from './pluggy.ts';
export { handleCreditCards } from './creditCards.ts';
