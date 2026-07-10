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
  const [ssoStatus, setSsoStatus] = useState<"exchanging" | "failed" | null>(() => {
    try {
      return new URLSearchParams(window.location.search).has("sso") ? "exchanging" : null;
    } catch {
      return null;
    }
  });

  // Platform SSO: when launched from the policing platform with ?sso=<token>,
  // exchange the launch token for a local Social Media session before login.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso");
    if (!ssoToken) return;
    params.delete("sso");
    const cleaned = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", cleaned);
    fetch(`${apiBaseUrl}/api/v1/auth/platform-sso`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: ssoToken }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "SSO failed");
        const newAuth: AuthState = { user: data.user, token: data.token };
        setAuth(newAuth);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newAuth));
        setSsoStatus(null);
      })
      .catch((err) => {
        console.warn("Platform SSO failed:", err instanceof Error ? err.message : "unknown");
        setSsoStatus("failed");
      });
  }, []);

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

  const clearSsoStatus = useCallback(() => setSsoStatus(null), []);

  const roles: string[] = auth?.user.roles || [];
  return { auth, login, logout, authHeaders, roles, ssoStatus, clearSsoStatus };
}
