import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { clearCitizenCachedState } from "./cache";

export interface User {
  user_id: string;
  login: string;
  name: string;
  email?: string;
  phone?: string;
  user_type: "CITIZEN" | "OFFICER" | "ADMIN";
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
  /** Helper that returns fetch init with headers and credentials */
  authHeaders: () => RequestInit;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "puda_citizen_auth";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSessionState = useCallback((clearStorage: boolean) => {
    setUser(null);
    if (clearStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
    clearCitizenCachedState();
  }, []);

  useEffect(() => {
    // Load user from localStorage for immediate UI, then verify session via cookie
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // Verify session with server (cookie is sent automatically)
    fetch(`${apiBaseUrl}/api/v1/auth/me`, { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        // Session invalid — clear local state
        clearSessionState(true);
        return null;
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
        }
      })
      .catch(() => {
        // Network error — keep cached user for offline support
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((userData: User) => {
    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
    clearSessionState(true);
  }, [clearSessionState]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      const storedUser = localStorage.getItem(STORAGE_KEY);
      if (!storedUser) {
        clearSessionState(false);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearSessionState]);

  const authHeaders = useCallback((): RequestInit => {
    return { headers: { "Content-Type": "application/json" }, credentials: "include" };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, authHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
