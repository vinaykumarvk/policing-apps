# P13 Forensic Platform Launch Pipeline

This execution harness was generated with `$plan-to-pipeline` for a single extension phase after the original P0-P12 integration pipeline.

The original P12 production release gate remains parked at human approval. This P13 harness does not approve production deployment. It implements and verifies Forensic as a platform-launched pilot route so the release gate can be amended and reviewed.

## Files

- `phases.yaml`: single P13 phase manifest.
- `prompts/P13.md`: Codex goal envelope for the P13 implementation.
- `checks/p13.sh`: external oracle for P13.
- `run.sh`: generic plan-to-pipeline driver.
- `.state/`, `approvals/`, `logs/`: runtime folders ignored by git.

## Usage

```bash
cd docs/spec/pipeline-p13
./run.sh
./run.sh --status
CODEX_FLAGS="--sandbox danger-full-access" ./run.sh --execute
touch approvals/P13.approved
./run.sh --execute
```

## Check-Authoring Gap

P13 uses a real external check script but remains `gate: human` because enabling a new policing domain route requires review of security, legal, and operational judgment. The check can prove implementation evidence; it cannot approve production pilot operation.

## Safety Notes

- Social Media remains planned.
- Knowledge Search remains blocked.
- No production credentials or real forensic evidence are used.
- No destructive database operation is permitted.
- Rollback is to remove the Forensic launch URL and proxy route while retaining adapter tests as evidence.

