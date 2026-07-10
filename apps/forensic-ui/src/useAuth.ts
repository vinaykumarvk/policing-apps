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
  const [ssoStatus, setSsoStatus] = useState<"exchanging" | "failed" | null>(() => {
    try {
      return new URLSearchParams(window.location.search).has("sso") ? "exchanging" : null;
    } catch {
      return null;
    }
  });

  // Platform SSO: when launched from the policing platform with ?sso=<token>,
  // exchange the launch token for a local Forensic session (sets the auth cookie).
  useEffect(() => {
    if (ssoStatus !== "exchanging") return;
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso");
    if (!ssoToken) {
      setSsoStatus(null);
      return;
    }
    params.delete("sso");
    const cleaned = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", cleaned);
    fetch(`${apiBaseUrl}/api/v1/auth/platform-sso`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token: ssoToken }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "SSO failed");
        const newAuth: AuthState = { user: data.user };
        setAuth(newAuth);
        localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
        setSsoStatus(null);
      })
      .catch((err) => {
        console.warn("Platform SSO failed:", err instanceof Error ? err.message : "unknown");
        setSsoStatus("failed");
      });
  }, [ssoStatus]);

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
    if (ssoStatus === "exchanging") return; // don't clear auth while an SSO exchange is in flight
    fetch(`${apiBaseUrl}/api/v1/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          setAuth(null);
          localStorage.removeItem(STORAGE_USER);
        }
      })
      .catch((err) => { console.warn("Session verify failed:", err instanceof Error ? err.message : "unknown"); });
  }, [ssoStatus]);

  const clearSsoStatus = useCallback(() => setSsoStatus(null), []);

  const roles: string[] = auth?.user.roles || [];
  return { auth, login, logout, authHeaders, roles, ssoStatus, clearSsoStatus };
}
