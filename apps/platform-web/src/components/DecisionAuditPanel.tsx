import type { PlatformAppView, PlatformMeResponse } from "../platform-api";

interface DecisionAuditPanelProps {
  apps: readonly PlatformAppView[];
  me: PlatformMeResponse;
  registryVersion: string;
}

export function DecisionAuditPanel({ apps, me, registryVersion }: DecisionAuditPanelProps): JSX.Element {
  const activeRoutes = apps.filter((app) => app.launch_url && app.state !== "planned" && app.state !== "blocked");

  return (
    <section className="audit-panel" id="audit" aria-labelledby="decision-audit-heading">
      <div className="surface-inner">
        <div className="section-heading">
          <p className="eyebrow">Decision audit</p>
          <h2 id="decision-audit-heading">Registry decisions</h2>
        </div>

        <div className="audit-strip" aria-label="Session and registry summary">
          <div>
            <span>Subject</span>
            <strong>{me.subject.display_name}</strong>
          </div>
          <div>
            <span>Persona</span>
            <strong>{me.subject.persona}</strong>
          </div>
          <div>
            <span>Registry</span>
            <strong>{registryVersion}</strong>
          </div>
          <div>
            <span>Active routes</span>
            <strong>{activeRoutes.length}</strong>
          </div>
        </div>

        <div className="audit-list">
          {apps.map((app) => (
            <article key={app.id} className="audit-row" data-state={app.state}>
              <div>
                <h3>{app.label}</h3>
                <p>{app.status_reason_code}</p>
              </div>
              <dl>
                <div>
                  <dt>Entitlement</dt>
                  <dd>{app.entitlement.reason}</dd>
                </div>
                <div>
                  <dt>Policy</dt>
                  <dd>{app.entitlement.policy_version}</dd>
                </div>
                <div>
                  <dt>Claim gate</dt>
                  <dd>{app.platform_claim_gate.reason_code}</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{app.platform_claim_gate.evidence_ref}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
