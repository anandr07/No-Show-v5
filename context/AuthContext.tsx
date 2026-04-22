import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { authClient, type AuthUser } from "@/lib/auth-client";

const GUEST_KEY = "auth_guest_mode";

interface AuthContextValue {
  user: AuthUser | null;
  isGuest: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authClient.getSession(),
      AsyncStorage.getItem(GUEST_KEY),
    ]).then(([session, guestFlag]) => {
      setUser(session?.user ?? null);
      setIsGuest(!session?.user && guestFlag === "true");
      setIsLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: authUser, error } = await authClient.signIn(email, password);
    if (error) return { error };
    await AsyncStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
    setUser(authUser);
    router.replace("/");
    return { error: null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { user: authUser, error } = await authClient.signUp(email, password, displayName);
      if (error) return { error };
      await AsyncStorage.removeItem(GUEST_KEY);
      setIsGuest(false);
      setUser(authUser);
      router.replace("/");
      return { error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await authClient.signOut();
    await AsyncStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
    setUser(null);
    router.replace("/auth");
  }, []);

  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, "true");
    setIsGuest(true);
    router.replace("/");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest,
        isLoading,
        signIn,
        signUp,
        signOut,
        continueAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
