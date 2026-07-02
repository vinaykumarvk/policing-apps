# P15 Knowledge Platform Launch Pipeline

This execution harness was generated with `$plan-to-pipeline` for a single extension phase after P14.

The original P12 production release gate and the P13/P14 human gates remain parked. This P15 harness does not approve production deployment or real RAG corpus ingestion. It implements and verifies Knowledge Search as a bounded platform-launched pilot route so the release gate can be amended and reviewed.

## Files

- `phases.yaml`: single P15 phase manifest.
- `prompts/P15.md`: Codex goal envelope for the P15 implementation.
- `checks/p15.sh`: external oracle for P15.
- `run.sh`: generic plan-to-pipeline driver.
- `.state/`, `approvals/`, `logs/`: runtime folders ignored by git.

## Usage

```bash
cd docs/spec/pipeline-p15
./run.sh
./run.sh --status
CODEX_FLAGS="--sandbox danger-full-access" ./run.sh --execute
touch approvals/P15.approved
./run.sh --execute
```

## Check-Authoring Gap

P15 uses a real external check script but remains `gate: human` because enabling a policing Knowledge/RAG route requires security, legal, data-governance, and operational review. The check can prove implementation evidence; it cannot approve production RAG operation or real corpus ingestion.

## Safety Notes

- Knowledge must remain deny-by-default outside the P15 adapter-controlled scoped retrieval path.
- No production credentials, provider keys, object-storage secrets, or real knowledge corpus data are used.
- No destructive database operation is permitted.
- DOPAMS, IQW, Forensic, and Social Media pilot routes must remain green.
- Rollback is to remove the Knowledge launch URL and proxy route while retaining adapter tests as non-active evidence.
