/** Legacy public-preview entry is retired. Real authentication is required. */
export function isPublicDemo(): boolean {
  return false;
}
export function enterPublicDemo(): void {
  window.location.assign("/");
}
export function exitPublicDemo(): void {
  window.location.assign("/");
}
/** Learner data now always belongs to the regular authenticated app flow. */
export const learnerStorage = {
  getItem(key: string): string | null {
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
  },
};
