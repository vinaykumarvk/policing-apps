import type { AuthorizationDecisionEvidence } from "../../../packages/audit-ledger/src";
import {
  createPlatformAppRegistry,
  type PlatformAppDefinition,
} from "./app-registry";
import {
  type DecisionEvidenceSink,
  type PlatformHealthCheck,
  handlePlatformRoute,
  platformRuntimeHealthCheck,
  registryHealthCheck,
} from "./routes/platform.routes";
import {
  createCaseProjectionService,
  type CaseProjectionService,
} from "./services/case-projection";
import {
  createEvidenceProjectionService,
  type EvidenceProjectionService,
} from "./services/evidence-projection";

export interface PlatformApiOptions {
  apps?: readonly PlatformAppDefinition[];
  evidenceSink?: DecisionEvidenceSink;
  healthChecks?: readonly PlatformHealthCheck[];
  caseProjectionService?: CaseProjectionService;
  evidenceProjectionService?: EvidenceProjectionService;
  now?: () => Date;
  expectedSourceVersion?: string;
  /** DEMO MODE ONLY: mark every launch-capable app as launchable in /apps too. */
  demoAllowAllLaunches?: boolean;
}

export interface DecisionEvidenceLog extends DecisionEvidenceSink {
  all: () => readonly Readonly<AuthorizationDecisionEvidence>[];
  clear: () => void;
}

export interface PlatformApiApp {
  handle: (request: Request) => Promise<Response>;
  fetch: (request: Request) => Promise<Response>;
  apps: readonly PlatformAppDefinition[];
  decisionEvidence: DecisionEvidenceLog;
}

export function createPlatformApp(options: PlatformApiOptions = {}): PlatformApiApp {
  const apps = createPlatformAppRegistry(options.apps);
  const decisionEvidence = createDecisionEvidenceLog();
  const evidenceSink = fanOutDecisionEvidenceSink(decisionEvidence, options.evidenceSink);
  const now = options.now ?? (() => new Date());
  const healthChecks = [
    platformRuntimeHealthCheck(),
    registryHealthCheck(apps),
    ...(options.healthChecks ?? []),
  ];
  const caseProjectionService = options.caseProjectionService ?? createCaseProjectionService();
  const evidenceProjectionService = options.evidenceProjectionService ?? createEvidenceProjectionService();
  const expectedSourceVersion = options.expectedSourceVersion ?? "idp-seed-v1";

  const handle = (request: Request): Promise<Response> =>
    handlePlatformRoute(request, {
      apps,
      evidenceSink,
      healthChecks,
      caseProjectionService,
      evidenceProjectionService,
      now,
      expectedSourceVersion,
      demoAllowAllLaunches: options.demoAllowAllLaunches ?? false,
    });

  return {
    handle,
    fetch: handle,
    apps,
    decisionEvidence,
  };
}

export function createDecisionEvidenceLog(): DecisionEvidenceLog {
  const entries: Readonly<AuthorizationDecisionEvidence>[] = [];
  return {
    append: (evidence) => {
      entries.push(evidence);
    },
    all: () => [...entries],
    clear: () => {
      entries.length = 0;
    },
  };
}

function fanOutDecisionEvidenceSink(
  internalSink: DecisionEvidenceSink,
  externalSink: DecisionEvidenceSink | undefined,
): DecisionEvidenceSink {
  return {
    append: async (evidence) => {
      await internalSink.append(evidence);
      if (externalSink) {
        await externalSink.append(evidence);
      }
    },
  };
}
