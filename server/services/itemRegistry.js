// Central registry for connected Pluggy Item IDs
// IDs are resolved dynamically at runtime via GET /items.
// Add hardcoded IDs here only in private/local environments via .env, not in source control.
const registeredItemIds = new Set<string>();


export function getItemIds() {
  return Array.from(registeredItemIds);
}

export function addItemId(id) {
  if (id && typeof id === 'string') {
    registeredItemIds.add(id);
  }
  return Array.from(registeredItemIds);
}

export function removeItemId(id) {
  if (id) {
    registeredItemIds.delete(id);
  }
  return Array.from(registeredItemIds);
}
