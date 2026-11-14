/** Public UI mode, never an authenticated identity. Session-local and tab-scoped. */
const MODE_KEY = "bml.public-demo-mode.v1";
export function isPublicDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(MODE_KEY) === "1";
  } catch {
    return false;
  }
}
export function enterPublicDemo(): void {
  window.sessionStorage.setItem(MODE_KEY, "1");
  window.location.assign("/auth/dashboard");
}
export function exitPublicDemo(): void {
  window.sessionStorage.removeItem(MODE_KEY);
  window.location.assign("/");
}
/** Demo UI persistence cannot read or overwrite real learner data. */
export const learnerStorage = {
  getItem(key: string): string | null {
    return isPublicDemo()
      ? window.sessionStorage.getItem("bml.demo." + key)
      : window.localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (isPublicDemo()) window.sessionStorage.setItem("bml.demo." + key, value);
    else window.localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (isPublicDemo()) window.sessionStorage.removeItem("bml.demo." + key);
    else window.localStorage.removeItem(key);
  },
};
