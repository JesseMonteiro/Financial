// Central registry for connected Pluggy Item IDs
const registeredItemIds = new Set([
  '62c2ec62-0cfa-40c7-9a83-b33c5ff60d98', // Santander (Original)
  '04775c52-baac-46fb-9fb8-7809704ae24e', // Item 1
  '316d7b45-fe30-459a-911b-664661ec09f7', // Item 2
  '759d5504-0389-461a-8341-c1b68d30aef1', // Item 3
  '80928b26-6e8b-4bc0-b84b-b78be20f9be6', // Item 4
  '671793dd-be2b-4dab-b6c2-c6ca5b1b0681'  // Item 5
]);

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
