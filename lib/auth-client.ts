import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/api-url";

const TOKEN_KEY = "auth_token";

function getApiBase(): string {
  // Always use the same host as WebSockets / React Query (not "" same-origin),
  // so Expo web (e.g. :8081) still talks to the API on :5000.
  return getApiUrl();
}

async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function setStoredToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function clearStoredToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: { display_name?: string };
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const base = getApiBase();
  return fetch(`${base}${path}`, { ...options, headers });
}

export const authClient = {
  async signUp(
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      const data = await res.json();
      if (!res.ok) return { user: null, error: data.error ?? "Sign up failed" };
      if (data.token) await setStoredToken(data.token);
      return { user: data.user, error: null };
    } catch (e) {
      const hint =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as Error).message)
          : String(e);
      return {
        user: null,
        error: `Cannot reach API (${getApiUrl()}). ${hint}. On a phone, set EXPO_PUBLIC_DOMAIN to your PC's LAN IP (see .env.example) or set EXPO_PUBLIC_API_URL.`,
      };
    }
  },

  async signIn(
    email: string,
    password: string
  ): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const res = await apiFetch("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { user: null, error: data.error ?? "Sign in failed" };
      if (data.token) await setStoredToken(data.token);
      return { user: data.user, error: null };
    } catch (e) {
      const hint =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as Error).message)
          : String(e);
      return {
        user: null,
        error: `Cannot reach API (${getApiUrl()}). ${hint}. On a phone, set EXPO_PUBLIC_DOMAIN to your PC's LAN IP or EXPO_PUBLIC_API_URL.`,
      };
    }
  },

  async signOut(): Promise<void> {
    try {
      await apiFetch("/api/auth/signout", { method: "POST" });
    } finally {
      await clearStoredToken();
    }
  },

  async getSession(): Promise<AuthSession | null> {
    try {
      const res = await apiFetch("/api/auth/session");
      const data = await res.json();
      if (!data.user) return null;
      const token = await getStoredToken();
      return { user: data.user, access_token: token ?? data.session?.access_token ?? "" };
    } catch {
      return null;
    }
  },

  getStoredToken,
};
