/**
 * GAS-based auth context for the static GitHub Pages portal.
 * Replaces Better Auth + server middleware with a simple token + localStorage.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { gasLogin, gasLogout, gasSession, getToken, getStoredUser, type GasUser } from "./api";

type AuthState = {
  user: GasUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<GasUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => { throw new Error("AuthProvider not mounted"); },
  signOut: async () => {},
});

export function GasAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GasUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Validate the stored token on mount
  useEffect(() => {
    let active = true;
    (async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const validUser = await gasSession();
        if (active) setUser(validUser);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await gasLogin(email, password);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    await gasLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useGasAuth(): AuthState {
  return useContext(AuthContext);
}

/** Quick check for the stored user without React context (for router guards). */
export function hasStoredSession(): boolean {
  return getToken() !== null && getStoredUser() !== null;
}
