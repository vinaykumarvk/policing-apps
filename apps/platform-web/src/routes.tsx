import type { PlatformAppState, PlatformAppView } from "./platform-api";

export interface ShellRoute {
  id: string;
  label: string;
  path: string;
}

export interface ModuleRouteRow {
  id: string;
  label: string;
  state: PlatformAppState;
  routePath: string | null;
  routeStatus: "active" | "unavailable";
  reasonCode: string;
}

export const SHELL_ROUTES: readonly ShellRoute[] = [
  { id: "launcher", label: "Apps", path: "/" },
  { id: "routes", label: "Routes", path: "/platform/routes" },
  { id: "audit", label: "Audit", path: "/platform/audit" },
];

export function moduleRouteRowsFromRegistry(apps: readonly PlatformAppView[]): ModuleRouteRow[] {
  return apps.map((app) => {
    const inactiveState = app.state === "planned" || app.state === "blocked";
    const routePath = inactiveState ? null : app.launch_url ?? null;
    return {
      id: app.id,
      label: app.label,
      state: app.state,
      routePath,
      routeStatus: routePath ? "active" : "unavailable",
      reasonCode: routePath ? app.platform_claim_gate.reason_code : app.launch_block_reason ?? app.status_reason_code,
    };
  });
}

export function RouteTable({ apps }: { apps: readonly PlatformAppView[] }): JSX.Element {
  const rows = moduleRouteRowsFromRegistry(apps);

  return (
    <section className="surface-band" aria-labelledby="route-table-heading">
      <div className="surface-inner">
        <div className="section-heading">
          <p className="eyebrow">Route table</p>
          <h2 id="route-table-heading">Module availability</h2>
        </div>
        <div className="route-table-wrap">
          <table className="route-table">
            <thead>
              <tr>
                <th scope="col">Module</th>
                <th scope="col">State</th>
                <th scope="col">Route</th>
                <th scope="col">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-state={row.state}>
                  <th scope="row">{row.label}</th>
                  <td>{stateLabel(row.state)}</td>
                  <td>
                    {row.routePath ? (
                      <a href={row.routePath} className="table-link">
                        {row.routePath}
                      </a>
                    ) : (
                      <span className="muted">No active route</span>
                    )}
                  </td>
                  <td>
                    <code>{row.reasonCode}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function stateLabel(state: PlatformAppState): string {
  return state
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
