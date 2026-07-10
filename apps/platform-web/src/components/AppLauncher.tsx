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

/** Icon glyphs keyed by app id; `default` covers future registry entries. */
const APP_ICON_PATHS: Record<string, string> = {
  dopams: "M12 3l8 4v5c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V7z M9.5 12l2 2 3.5-4",
  iqw: "M4 5h16v10H9l-5 4V5z M8 9h8 M8 12h5",
  forensic:
    "M12 3a7 7 0 0 1 7 7c0 4-2 7-4 9M12 6.5A3.5 3.5 0 0 1 15.5 10c0 3.5-1.5 6.5-3 8.5M12 10v2c0 2.5-1 4.8-2.5 6.5M8.6 7A7 7 0 0 0 5 10c0 2 .4 3.8 1.2 5.4",
  "social-media":
    "M3 12h4l2-6 4 12 2-6h6 M17.5 4.5a2 2 0 1 1 0 .01",
  knowledge: "M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2V5z M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6 M7.5 7H9.5 M14.5 7h2.5",
  default: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
};

function AppIcon({ appId }: { appId: string }): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={APP_ICON_PATHS[appId] ?? APP_ICON_PATHS.default} />
    </svg>
  );
}

function LaunchArrow(): JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

export function AppLauncher({ apps, registryVersion }: AppLauncherProps): JSX.Element {
  const counts = apps.reduce<Record<PlatformAppState, number>>(
    (accumulator, app) => ({
      ...accumulator,
      [app.state]: accumulator[app.state] + 1,
    }),
    { available: 0, pilot: 0, planned: 0, blocked: 0 },
  );

  return (
    <section className="launcher" id="apps" aria-labelledby="launcher-heading">
      <div className="surface-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">App registry</p>
            <h2 id="launcher-heading">Your applications</h2>
          </div>
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
                <span className="module-card__icon">
                  <AppIcon appId={app.id} />
                </span>
                <span className="module-card__idline">
                  <span className={`status-pill status-pill--${app.state}`}>{STATE_COPY[app.state]}</span>
                  <span className="module-domain">{app.domain}</span>
                </span>
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
                  <a
                    href={launchUrlForDisplay(app) ?? undefined}
                    className="launch-link"
                    target="_blank"
                    rel="noopener"
                  >
                    Open {app.label}
                    <LaunchArrow />
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
