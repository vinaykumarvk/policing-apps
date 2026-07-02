# P14 Social Media Platform Launch Pipeline

This execution harness was generated with `$plan-to-pipeline` for a single extension phase after P13.

The original P12 production release gate and P13 human gate remain parked. This P14 harness does not approve production deployment. It implements and verifies Social Media Intelligence as a platform-launched pilot route so the release gate can be amended and reviewed.

## Files

- `phases.yaml`: single P14 phase manifest.
- `prompts/P14.md`: Codex goal envelope for the P14 implementation.
- `checks/p14.sh`: external oracle for P14.
- `run.sh`: generic plan-to-pipeline driver.
- `.state/`, `approvals/`, `logs/`: runtime folders ignored by git.

## Usage

```bash
cd docs/spec/pipeline-p14
./run.sh
./run.sh --status
CODEX_FLAGS="--sandbox danger-full-access" ./run.sh --execute
touch approvals/P14.approved
./run.sh --execute
```

## Check-Authoring Gap

P14 uses a real external check script but remains `gate: human` because enabling a policing domain route requires security, legal, and operational review. The check can prove implementation evidence; it cannot approve production pilot operation.

## Safety Notes

- Knowledge Search remains blocked.
- No production credentials, connector secrets, or real social-media evidence are used.
- No destructive database operation is permitted.
- DOPAMS, IQW, and Forensic pilot routes must remain green.
- Rollback is to remove the Social Media launch URL and proxy route while retaining adapter tests as non-active evidence.
