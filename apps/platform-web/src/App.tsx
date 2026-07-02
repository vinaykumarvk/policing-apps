import { useEffect, useState } from "react";
import { AppLauncher } from "./components/AppLauncher";
import { DecisionAuditPanel } from "./components/DecisionAuditPanel";
import { RouteTable, SHELL_ROUTES } from "./routes";
import { fetchPlatformShellData, type PlatformShellData } from "./platform-api";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: PlatformShellData }
  | { status: "failed"; reason: string };

export default function App(): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
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
        </nav>
      </header>

      {loadState.status === "loading" ? <LoadingState /> : null}
      {loadState.status === "failed" ? <FailureState reason={loadState.reason} /> : null}
      {loadState.status === "ready" ? <ShellDashboard data={loadState.data} /> : null}
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

function LoadingState(): JSX.Element {
  return (
    <main className="status-page" aria-live="polite">
      <div className="status-panel">
        <p className="eyebrow">Platform API</p>
        <h2>Loading registry data</h2>
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
