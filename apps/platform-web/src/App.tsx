import { useCallback, useEffect, useState } from "react";
import { AppLauncher } from "./components/AppLauncher";
import { DecisionAuditPanel } from "./components/DecisionAuditPanel";
import { GovBanner, StateEmblem } from "./components/GovBranding";
import { LoginScreen } from "./components/LoginScreen";
import { UsersPanel } from "./components/UsersPanel";
import { RouteTable, SHELL_ROUTES } from "./routes";
import {
  canManageUsers,
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

  if (session.status === "signed-out") {
    return <LoginScreen onSignedIn={handleSignedIn} />;
  }

  return (
    <div className="app-shell">
      {session.status === "signed-in" ? <ShellHeader user={session.user} onSignOut={handleSignOut} /> : <GovBanner />}

      {session.status === "checking" ? <StatusPanel title="Checking session" /> : null}
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

function ShellHeader({
  user,
  onSignOut,
}: {
  user: PlatformSessionUser;
  onSignOut: () => void;
}): JSX.Element {
  const initials = user.display_name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="app-bar">
      <div className="app-bar__brand">
        <StateEmblem size={40} />
        <div className="app-bar__brand-text">
          <strong>Integrated Policing Platform</strong>
          <span>Kerala Police · Government of Kerala</span>
        </div>
      </div>
      <nav className="app-bar__nav" aria-label="Platform shell">
        {SHELL_ROUTES.map((route) => (
          <a key={route.id} href={route.path}>
            {route.label}
          </a>
        ))}
      </nav>
      <div className="app-bar__session">
        <div className="session-chip">
          <span className="session-chip__avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="session-chip__meta">
            <strong>{user.display_name}</strong>
            <span>{user.persona.replace(/[-_]/g, " ")}</span>
          </span>
        </div>
        <button type="button" className="sign-out" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}

function ShellDashboard({ data }: { data: PlatformShellData }): JSX.Element {
  return (
    <main>
      <section className="hero-band" aria-labelledby="dashboard-heading">
        <div className="surface-inner hero-content">
          <div>
            <p className="eyebrow">Signed in</p>
            <h2 id="dashboard-heading">Welcome, {data.me.subject.display_name}</h2>
            <ul className="hero-meta">
              <li>{data.me.subject.org_id}</li>
              <li className={data.me.mfa_verified ? "hero-meta--verified" : undefined}>
                {data.me.mfa_verified ? "MFA verified" : "MFA not verified"}
              </li>
              <li>Claims expire {formatDateTime(data.me.expires_at)}</li>
            </ul>
          </div>
          <div className="hero-stat" aria-label="Registry total modules">
            <span>{data.registry.pagination.total}</span>
            <strong>registry modules</strong>
          </div>
        </div>
      </section>

      <AppLauncher apps={data.registry.apps} registryVersion={data.registry.registry_version} />
      {canManageUsers(data.me) ? <UsersPanel /> : null}
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
        <span className="status-spinner" aria-hidden="true" />
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
        <span className="status-error-icon" aria-hidden="true">
          !
        </span>
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
