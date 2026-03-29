import AsyncStorage from "@react-native-async-storage/async-storage";

/** Same key as `OnlineGameContext` — single source for online identity on device. */
export const STORAGE_ONLINE_USER_ID = "@noshow/online_user_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(s: string | null | undefined): s is string {
  return Boolean(s && UUID_RE.test(s));
}

function randomUUIDv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ensures a persisted anonymous id is a real UUID (Postgres `users` / online tables).
 * Migrates legacy non-UUID values to a new UUID once.
 */
export async function ensureGuestOnlineUserId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_ONLINE_USER_ID);
  if (isValidUuid(existing)) return existing;
  const id = randomUUIDv4();
  await AsyncStorage.setItem(STORAGE_ONLINE_USER_ID, id);
  return id;
}

/** Use for API calls: signed-in account id wins, else stored guest UUID. */
export async function resolveOnlineAnalyticsUserId(
  authUserId: string | null | undefined
): Promise<string | null> {
  if (isValidUuid(authUserId)) return authUserId;
  const stored = await AsyncStorage.getItem(STORAGE_ONLINE_USER_ID);
  return isValidUuid(stored) ? stored : null;
}
