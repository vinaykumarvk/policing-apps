import { useState, useEffect, useCallback } from "react";
import { AuthState, apiBaseUrl } from "./types";

const STORAGE_KEY = "sm_auth";

function getStoredAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.token && parsed.user) return parsed;
    }
  } catch {}
  return null;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(getStoredAuth);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Invalid credentials");
    const newAuth: AuthState = { user: data.user, token: data.token };
    setAuth(newAuth);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAuth));
    return newAuth;
  };

  const logout = useCallback(() => {
    const stored = getStoredAuth();
    if (stored?.token) {
      fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${stored.token}` },
      }).catch(() => {});
    }
    setAuth(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const authHeaders = useCallback((): RequestInit => {
    const stored = getStoredAuth();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (stored?.token) headers.Authorization = `Bearer ${stored.token}`;
    return { headers };
  }, []);

  // Verify session on mount
  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored?.token) return;
    fetch(`${apiBaseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${stored.token}` },
    })
      .then((res) => {
        if (!res.ok) { setAuth(null); localStorage.removeItem(STORAGE_KEY); }
      })
      .catch(() => {});
  }, []);

  const roles: string[] = auth?.user.roles || [];
  return { auth, login, logout, authHeaders, roles };
}
