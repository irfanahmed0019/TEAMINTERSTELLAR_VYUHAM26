/** Public sample selector, never a verified identity or auth credential. */
export const DEMO_IDENTIFIER = "demo@buildmylogic.invalid";
export function isDemoPreviewIdentifier(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_IDENTIFIER;
}
