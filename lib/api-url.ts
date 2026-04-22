/**
 * Base URL for the Express API (same host as WebSockets).
 * Uses EXPO_PUBLIC_API_URL when set; otherwise builds from EXPO_PUBLIC_DOMAIN
 * (see `.env.example`). Mirrors the logic previously embedded in `query-client.ts`.
 */
export function getApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) {
    return explicit.endsWith("/") ? explicit.slice(0, -1) : explicit;
  }

  let host = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost:5000";

  const isWebLocalhost =
    typeof window !== "undefined" &&
    window?.location?.hostname &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]");
  if (isWebLocalhost) host = "127.0.0.1:5000";

  const isLocalHost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
  const protocol = isLocalHost ? "http" : host.startsWith("https") ? "https" : "http";

  const base = host.startsWith("http") ? host : `${protocol}://${host}`;
  return new URL(base).href.replace(/\/$/, "");
}
