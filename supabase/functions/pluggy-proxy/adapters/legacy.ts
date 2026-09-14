/** Legacy path adapter notes for web clients during /v1 migration. */
export function isLegacyPath(path: string): boolean {
  const clean = path.replace(/^\/+/, "");
  if (clean.startsWith("v1/")) return false;
  return true;
}
