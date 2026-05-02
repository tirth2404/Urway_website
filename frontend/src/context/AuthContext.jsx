import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, clearAccessToken, setAccessToken } from "../utils/apiClient";

const AuthContext = createContext(null);

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const didRestore = useRef(false);   // prevents double-call in React StrictMode

  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;

    fetch(`${BASE_URL}/api/auth/refresh`, {
      method:      "POST",
      credentials: "include",           // sends the HttpOnly cookie
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setAccessToken(data.accessToken);
        setUser({ userId: data.userId, virtualClusterTag: data.virtualClusterTag ?? null });
      })
      .catch(() => { /* no valid cookie — user is logged out, that's fine */ })
      .finally(() => setIsRestoring(false));
  }, []);

  const signIn = useCallback(async (email, password) => {
    const res  = await api.post("/api/auth/signin", { email, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Sign in failed.");
    setAccessToken(data.accessToken);
    setUser({ userId: data.userId, virtualClusterTag: data.virtualClusterTag });
    return data;
  }, []);

  const signOut = useCallback(async () => {
    try { await api.post("/api/auth/signout", {}); } catch { /* ignore */ }
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
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};