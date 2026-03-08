-- Migration 054: OSINT Documentation Standards
-- Capture metadata fields for court-ready evidence

-- OSINT capture metadata fields on evidence_item
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS capture_method TEXT;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS capture_tool_version TEXT;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS capture_timestamp TIMESTAMPTZ;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS source_platform TEXT;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS source_post_id TEXT;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS source_author_handle TEXT;

-- Seed OSINT Evidence Collection Report template
INSERT INTO report_template (template_name, template_type, template_body, variables)
VALUES (
  'OSINT Evidence Collection Report',
  'COURT_EXPORT',
  '# OSINT Evidence Collection Report

## Case Information
- **Case ID**: {{caseId}}
- **Evidence Reference**: {{evidenceRef}}
- **Report Date**: {{reportDate}}

## Evidence Metadata
- **Platform**: {{sourcePlatform}}
- **Source URL**: {{sourceUrl}}
- **Post ID**: {{sourcePostId}}
- **Author Handle**: {{sourceAuthorHandle}}
- **Capture Method**: {{captureMethod}}
- **Capture Tool Version**: {{captureToolVersion}}
- **Capture Timestamp**: {{captureTimestamp}}

## Integrity Verification
- **Hash Algorithm**: {{hashAlgorithm}}
- **Original Hash (SHA-256)**: {{hashSha256}}
- **Verification Result**: {{verificationResult}}
- **Verified By**: {{verifiedBy}}
- **Verified At**: {{verifiedAt}}

## Chain of Custody
{{custodyTimeline}}

## Officer Declaration
I, {{officerName}}, hereby declare that the above evidence was collected in accordance with
established OSINT procedures and ISO 27037 digital evidence handling standards. The evidence
has not been altered, modified, or tampered with since the time of collection.

**Signature**: ____________________
**Badge/ID**: {{officerBadge}}
**Date**: {{declarationDate}}
',
  '["caseId","evidenceRef","reportDate","sourcePlatform","sourceUrl","sourcePostId","sourceAuthorHandle","captureMethod","captureToolVersion","captureTimestamp","hashAlgorithm","hashSha256","verificationResult","verifiedBy","verifiedAt","custodyTimeline","officerName","officerBadge","declarationDate"]'::jsonb
)
ON CONFLICT DO NOTHING;
