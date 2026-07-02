import type { PlatformAppState, PlatformAppView } from "../platform-api";

interface AppLauncherProps {
  apps: readonly PlatformAppView[];
  registryVersion: string;
}

const STATE_COPY: Record<PlatformAppState, string> = {
  available: "Available",
  pilot: "Pilot",
  planned: "Planned",
  blocked: "Blocked",
};

export function AppLauncher({ apps, registryVersion }: AppLauncherProps): JSX.Element {
  const counts = apps.reduce<Record<PlatformAppState, number>>(
    (accumulator, app) => ({
      ...accumulator,
      [app.state]: accumulator[app.state] + 1,
    }),
    { available: 0, pilot: 0, planned: 0, blocked: 0 },
  );

  return (
    <section className="launcher" aria-labelledby="launcher-heading">
      <div className="surface-inner">
        <div className="section-heading">
          <p className="eyebrow">App registry</p>
          <h2 id="launcher-heading">Entitled modules</h2>
          <p className="registry-version">{registryVersion}</p>
        </div>

        <dl className="state-summary" aria-label="Registry state counts">
          {Object.entries(counts).map(([state, count]) => (
            <div key={state} className={`state-count state-count--${state}`}>
              <dt>{STATE_COPY[state as PlatformAppState]}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>

        <div className="module-grid">
          {apps.map((app) => (
            <article key={app.id} className={`module-card module-card--${app.state}`} data-state={app.state}>
              <div className="module-card__topline">
                <span className={`status-pill status-pill--${app.state}`}>{STATE_COPY[app.state]}</span>
                <span className="module-domain">{app.domain}</span>
              </div>
              <h3>{app.label}</h3>
              <p>{app.description}</p>
              <dl className="module-facts">
                <div>
                  <dt>Entitlement</dt>
                  <dd>{app.entitlement.reason}</dd>
                </div>
                <div>
                  <dt>Gate</dt>
                  <dd>{app.platform_claim_gate.reason_code}</dd>
                </div>
              </dl>
              <div className="module-actions">
                {launchUrlForDisplay(app) ? (
                  <a href={launchUrlForDisplay(app) ?? undefined} className="launch-link">
                    Open {app.label}
                  </a>
                ) : (
                  <span className="launch-unavailable" aria-disabled="true">
                    {app.launch_block_reason ?? app.status_reason_code}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function launchUrlForDisplay(app: PlatformAppView): string | null {
  if (app.state === "planned" || app.state === "blocked") {
    return null;
  }
  return app.launch_url ?? null;
}
