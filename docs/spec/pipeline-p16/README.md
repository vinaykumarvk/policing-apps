# P16 Pipeline Runner

This directory was generated with the `plan-to-pipeline` skill for P16: Pilot Cutover Readiness and Approval Evidence.

The driver runs P16 in a fresh Codex session and then verifies `bash docs/spec/pipeline-p16/checks/p16.sh` outside the model. P16 is intentionally `gate: human`; a green check proves the readiness package is internally consistent, not that production cutover is approved.

## Files

- `phases.yaml`: P16 manifest consumed by `run.sh`
- `run.sh`: generic Codex driver copied from the skill asset
- `prompts/P16.md`: goal envelope for the implementation session
- `checks/p16.sh`: independent P16 oracle
- `.state/`, `approvals/`, `logs/`: runtime folders ignored by git

## Usage

```bash
cd docs/spec/pipeline-p16
./run.sh
./run.sh --status
CODEX_FLAGS="--sandbox danger-full-access" ./run.sh --execute
touch approvals/P16.approved
./run.sh --execute
```

## Check-Authoring Gap

- `P16` uses a real executable oracle, not `true`.
- `P16` is still `gate: human` because production cutover approval is a judgment and must not be automated.
- The oracle validates evidence consistency and reruns the P15 predecessor gate. It does not start production services, approve owners, or validate real production credentials.

## Rollback

P16 should not change runtime route exposure or production policy. If checks fail, fix the readiness evidence and rerun. If P15 fails during P16, quarantine the affected route and repair the predecessor gate before retrying P16.
