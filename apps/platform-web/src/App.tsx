import { useCallback, useEffect, useState } from "react";
import { AppLauncher } from "./components/AppLauncher";
import { DecisionAuditPanel } from "./components/DecisionAuditPanel";
import { LoginScreen } from "./components/LoginScreen";
import { RouteTable, SHELL_ROUTES } from "./routes";
import {
  fetchPlatformSession,
  fetchPlatformShellData,
  platformLogout,
  type PlatformSessionUser,
  type PlatformShellData,
} from "./platform-api";

type SessionState =
  | { status: "checking" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: PlatformSessionUser };

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: PlatformShellData }
  | { status: "failed"; reason: string };

export default function App(): JSX.Element {
  const [session, setSession] = useState<SessionState>({ status: "checking" });
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetchPlatformSession()
      .then((response) => {
        if (!active) {
          return;
        }
        setSession(
          response.authenticated && response.user
            ? { status: "signed-in", user: response.user }
            : { status: "signed-out" },
        );
      })
      .catch(() => {
        if (active) {
          setSession({ status: "signed-out" });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (session.status !== "signed-in") {
      return;
    }
    let active = true;
    setLoadState({ status: "loading" });
    fetchPlatformShellData()
      .then((data) => {
        if (active) {
          setLoadState({ status: "ready", data });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadState({
            status: "failed",
            reason: error instanceof Error ? error.message : "PLATFORM_API_UNAVAILABLE",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [session.status]);

  const handleSignedIn = useCallback((user: PlatformSessionUser) => {
    setSession({ status: "signed-in", user });
  }, []);

  const handleSignOut = useCallback(() => {
    void platformLogout().finally(() => {
      setSession({ status: "signed-out" });
      setLoadState({ status: "loading" });
    });
  }, []);

  return (
    <div className="app-shell">
      <header className="platform-header">
        <div>
          <p className="eyebrow">Punjab Police</p>
          <h1>Policing Platform</h1>
        </div>
        <nav aria-label="Platform shell">
          {SHELL_ROUTES.map((route) => (
            <a key={route.id} href={route.path}>
              {route.label}
            </a>
          ))}
          {session.status === "signed-in" ? (
            <button type="button" className="sign-out" onClick={handleSignOut}>
              Sign out
            </button>
          ) : null}
        </nav>
      </header>

      {session.status === "checking" ? <StatusPanel title="Checking session" /> : null}
      {session.status === "signed-out" ? <LoginScreen onSignedIn={handleSignedIn} /> : null}
      {session.status === "signed-in" ? (
        <>
          {loadState.status === "loading" ? <StatusPanel title="Loading registry data" /> : null}
          {loadState.status === "failed" ? <FailureState reason={loadState.reason} /> : null}
          {loadState.status === "ready" ? <ShellDashboard data={loadState.data} /> : null}
        </>
      ) : null}
    </div>
  );
}

function ShellDashboard({ data }: { data: PlatformShellData }): JSX.Element {
  return (
    <main>
      <section className="hero-band" aria-labelledby="dashboard-heading">
        <div className="surface-inner hero-content">
          <div>
            <p className="eyebrow">Signed in</p>
            <h2 id="dashboard-heading">{data.me.subject.display_name}</h2>
            <p>
              {data.me.subject.org_id} · MFA {data.me.mfa_verified ? "verified" : "not verified"} · Claims expire{" "}
              {formatDateTime(data.me.expires_at)}
            </p>
          </div>
          <div className="hero-stat" aria-label="Registry total modules">
            <span>{data.registry.pagination.total}</span>
            <strong>registry modules</strong>
          </div>
        </div>
      </section>

      <AppLauncher apps={data.registry.apps} registryVersion={data.registry.registry_version} />
      <RouteTable apps={data.registry.apps} />
      <DecisionAuditPanel
        apps={data.registry.apps}
        me={data.me}
        registryVersion={data.registry.registry_version}
      />
    </main>
  );
}

function StatusPanel({ title }: { title: string }): JSX.Element {
  return (
    <main className="status-page" aria-live="polite">
      <div className="status-panel">
        <p className="eyebrow">Platform API</p>
        <h2>{title}</h2>
      </div>
    </main>
  );
}

function FailureState({ reason }: { reason: string }): JSX.Element {
  return (
    <main className="status-page" role="alert">
      <div className="status-panel status-panel--error">
        <p className="eyebrow">Platform API</p>
        <h2>Registry unavailable</h2>
        <p>{reason}</p>
      </div>
    </main>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
