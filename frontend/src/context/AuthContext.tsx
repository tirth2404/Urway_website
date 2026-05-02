import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, clearAccessToken, setAccessToken } from '../utils/apiClient';

type AuthUser = {
  userId: string;
  virtualClusterTag?: string | null;
};

type AuthResponse = {
  accessToken: string;
  userId: string;
  virtualClusterTag?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  isRestoring: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const didRestore = useRef(false); // prevents double-call in React StrictMode

  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;

    fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends the HttpOnly cookie
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as AuthResponse;
        setAccessToken(data.accessToken);
        setUser({ userId: data.userId, virtualClusterTag: data.virtualClusterTag ?? null });
      })
      .catch(() => { /* no valid cookie — user is logged out, that's fine */ })
      .finally(() => setIsRestoring(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/auth/signin', { email, password });
    if (!res) throw new Error('Sign in failed. Please try again.');
    const data = (await res.json()) as AuthResponse;
    if (!res.ok) throw new Error((data as unknown as { error?: string })?.error || 'Sign in failed.');
    setAccessToken(data.accessToken);
    setUser({ userId: data.userId, virtualClusterTag: data.virtualClusterTag ?? null });
    return data;
  }, []);

  const signOut = useCallback(async () => {
    try {
      const res = await api.post('/api/auth/signout', {});
      if (!res) return;
    } catch {
      /* ignore */
    }
    clearAccessToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isRestoring, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};