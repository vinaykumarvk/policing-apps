# Policing Platform Integration Pipeline

This execution harness was generated from `docs/spec/phased-plan.yaml` using `$plan-to-pipeline`.

It sequences the integration as fresh Codex sessions, one phase at a time. Each phase has an external check in `checks/`; the driver runs that check outside Codex before advancing or parking at a human gate.

## Usage

```bash
cd docs/spec/pipeline
./run.sh
./run.sh --status
git checkout -b pipeline-run
./run.sh --execute
touch approvals/<ID>.approved
./run.sh --execute
./run.sh --from <ID>
./run.sh --reset <ID>
```

Do not run `--execute` on `main` or `master`; the driver refuses it. Review each prompt and check before execution.

This installed Codex CLI accepts sandbox flags on `codex exec`, but not the interactive `--ask-for-approval` flag.

## Gates

- `P0`, `P1`, `P2`, `P3`, `P4`, `P7`, `P8`, `P9`, `P10`, and `P12` are human-gated because they include source migration, security policy, data classification, legal/operational judgment, or release approval.
- `P5`, `P6`, and `P11` are auto-gated because their success is primarily package/API/deployment checks that can be verified by external commands.

## Check-Authoring Gap

No phase uses `exit_criteria: true`; every phase has a concrete check script.

The following checks are partial because the final acceptance still requires human judgment after the script passes:

- `P0`: secret hygiene and source inclusion approval.
- `P1`: ownership and migration layout approval.
- `P2`: entitlement semantics approval.
- `P3`: ABAC, threat model, and decision evidence approval.
- `P4`: synthetic fixture and no-real-PII approval.
- `P7`: operator UX and unavailable-module behavior approval.
- `P8`: auth adapter bypass and break-glass approval.
- `P9`: projection, retention, legal hold, and redaction approval.
- `P10`: knowledge runtime selection and retrieval-safety approval.
- `P12`: production pilot governance and release approval.

## Safety

- The release objective is to prove the control plane with DOPAMS and IQW only.
- Social Media, Forensic, and Knowledge routes stay planned or blocked until their gates pass.
- No active route is allowed unless the backing domain enforces platform claims server-side.
- Central evidence responses must not expose `storage_uri` by default.
- Knowledge query UI remains disabled until scoped retrieval and citation filtering are proven.
