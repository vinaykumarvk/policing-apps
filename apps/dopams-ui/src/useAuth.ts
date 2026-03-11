import { useState, useEffect, useCallback } from "react";
import { AuthState, UserAccount, apiBaseUrl } from "./types";

const STORAGE_USER = "dopams_auth_user";
const STORAGE_TOKEN = "dopams_auth_token";

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
    const token = localStorage.getItem(STORAGE_TOKEN);
    fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }).catch((err) => { console.warn("Logout request failed:", err instanceof Error ? err.message : "unknown"); });
    setAuth(null);
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_TOKEN);
  }, []);

  const authHeaders = useCallback((): RequestInit => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    return {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  }, []);

  // Verify session on mount
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) return;
    fetch(`${apiBaseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
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
