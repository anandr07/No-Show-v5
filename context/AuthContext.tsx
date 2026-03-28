import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { router } from "expo-router";
import { authClient, type AuthUser } from "@/lib/auth-client";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then((session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: authUser, error } = await authClient.signIn(email, password);
    if (error) return { error };
    setUser(authUser);
    router.replace("/");
    return { error: null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { user: authUser, error } = await authClient.signUp(email, password, displayName);
      if (error) return { error };
      setUser(authUser);
      router.replace("/");
      return { error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
    router.replace("/");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
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
