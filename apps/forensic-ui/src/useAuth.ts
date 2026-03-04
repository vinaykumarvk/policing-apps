import { useState, useEffect, useCallback } from "react";
import { AuthState, apiBaseUrl } from "./types";

const STORAGE_USER = "forensic_auth_user";
const STORAGE_TOKEN = "forensic_auth_token";

function getStoredAuth(): AuthState | null {
  try {
    const u = localStorage.getItem(STORAGE_USER);
    const t = localStorage.getItem(STORAGE_TOKEN);
    if (u && t) return { user: JSON.parse(u), token: t };
  } catch {}
  return null;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(getStoredAuth);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Invalid credentials");
    const newAuth: AuthState = { user: data.user, token: data.token };
    setAuth(newAuth);
    localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
    localStorage.setItem(STORAGE_TOKEN, data.token);
    return newAuth;
  };

  const logout = useCallback(() => {
    fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }).catch((err) => { console.warn("Logout request failed:", err instanceof Error ? err.message : "unknown"); });
    setAuth(null);
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_TOKEN);
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (auth?.token) h["Authorization"] = `Bearer ${auth.token}`;
    return h;
  }, [auth?.token]);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          setAuth(null);
          localStorage.removeItem(STORAGE_USER);
          localStorage.removeItem(STORAGE_TOKEN);
        }
      })
      .catch((err) => { console.warn("Session verify failed:", err instanceof Error ? err.message : "unknown"); });
  }, []);

  const roles: string[] = auth?.user.roles || [];
  return { auth, login, logout, authHeaders, roles };
}
