import { useState, useEffect, useCallback } from "react";
import { AuthState, apiBaseUrl } from "./types";

const STORAGE_USER = "forensic_auth_user";

function getStoredAuth(): AuthState | null {
  try {
    const u = localStorage.getItem(STORAGE_USER);
    if (u) return { user: JSON.parse(u) };
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
    const newAuth: AuthState = { user: data.user };
    setAuth(newAuth);
    localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
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
  }, []);

  const authHeaders = useCallback((): RequestInit => {
    return { headers: { "Content-Type": "application/json" }, credentials: "include" };
  }, []);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          setAuth(null);
          localStorage.removeItem(STORAGE_USER);
        }
      })
      .catch((err) => { console.warn("Session verify failed:", err instanceof Error ? err.message : "unknown"); });
  }, []);

  const roles: string[] = auth?.user.roles || [];
  return { auth, login, logout, authHeaders, roles };
}
