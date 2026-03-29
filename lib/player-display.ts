const MAX_NAME_LEN = 24;

export function sanitizeDisplayName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LEN);
}

export function resolvePlayerDisplayName(params: {
  /** Locally saved in-game / profile name (AsyncStorage). */
  localName: string;
  authDisplayName?: string | null;
  email?: string | null;
  fallback?: string;
}): string {
  const local = sanitizeDisplayName(params.localName);
  if (local.length > 0) return local;
  const auth = params.authDisplayName?.trim();
  if (auth) return auth.slice(0, MAX_NAME_LEN);
  if (params.email) {
    const part = params.email.split("@")[0]?.trim();
    if (part) return part.slice(0, MAX_NAME_LEN);
  }
  return params.fallback ?? "Player";
}
