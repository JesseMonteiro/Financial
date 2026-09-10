/** True until the store has finished its first fetch (or already has rows). */
export function isInitialEmpty(items, loading, lastUpdated, error) {
  if (error) return false;
  return (!items || items.length === 0) && (Boolean(loading) || lastUpdated == null);
}
