/** Auth hook for officer portal — manages login, logout, postings */
import { useState, useEffect, useCallback } from "react";
import { OfficerAuth, OfficerPosting, apiBaseUrl } from "./types";

const STORAGE_USER = "puda_officer_auth";

function getStoredAuth(): OfficerAuth | null {
  try {
    const u = localStorage.getItem(STORAGE_USER);
    if (u) return { user: JSON.parse(u) };
  } catch {}
  return null;
}

export function useOfficerAuth() {
  const [auth, setAuth] = useState<OfficerAuth | null>(getStoredAuth);
  const [postings, setPostings] = useState<OfficerPosting[]>([]);

  const login = async (loginId: string, password: string) => {
    const res = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ login: loginId, password }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Invalid credentials");
    if (data.user.user_type !== "OFFICER") throw new Error("Access denied. Officer login only.");
    const newAuth: OfficerAuth = { user: data.user };
    setAuth(newAuth);
    localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
    return newAuth;
  };

  const logout = () => {
    fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }).catch((err) => { console.warn("Logout request failed:", err instanceof Error ? err.message : "unknown"); });
    setAuth(null);
    setPostings([]);
    localStorage.removeItem(STORAGE_USER);
  };

  const authHeaders = useCallback((): RequestInit => {
    return { headers: { "Content-Type": "application/json" }, credentials: "include" };
  }, []);

  // Verify session on mount via HttpOnly cookie
  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          setAuth(null);
          setPostings([]);
          localStorage.removeItem(STORAGE_USER);
        }
      })
      .catch((err) => { console.warn("Session verify failed:", err instanceof Error ? err.message : "unknown"); });
  }, []);

  // Load postings when auth changes
  useEffect(() => {
    if (!auth) return;
    fetch(`${apiBaseUrl}/api/v1/auth/me/postings?userId=${auth.user.user_id}`, authHeaders())
      .then((res) => (res.ok ? res.json() : { postings: [] }))
      .then((data) => setPostings(data.postings || []))
      .catch((err) => { console.warn("Postings fetch failed:", err instanceof Error ? err.message : "unknown"); });
  }, [auth?.user.user_id]);

  const roles = postings.flatMap((p) => p.system_role_ids);
  const authorities = [...new Set(postings.map((p) => p.authority_id))];

  return { auth, login, logout, authHeaders, postings, roles, authorities };
}
