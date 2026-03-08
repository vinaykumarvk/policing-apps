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

-- Seed OSINT Evidence Collection Report template (uses correct column names: name, content_jsonb, content_schema)
INSERT INTO report_template (name, template_type, content_jsonb, content_schema, is_active)
VALUES (
  'OSINT Evidence Collection Report',
  'COURT_EXPORT',
  '{
    "header": { "title": "OSINT Evidence Collection Report", "subtitle": "ISO 27037 Compliant Digital Evidence Documentation" },
    "sections": [
      { "type": "keyValue", "title": "Case Information", "entries": [
        { "label": "Case ID", "value": "{{caseId}}" },
        { "label": "Evidence Reference", "value": "{{evidenceRef}}" },
        { "label": "Report Date", "value": "{{reportDate}}" }
      ]},
      { "type": "keyValue", "title": "Evidence Metadata", "entries": [
        { "label": "Platform", "value": "{{sourcePlatform}}" },
        { "label": "Source URL", "value": "{{sourceUrl}}" },
        { "label": "Post ID", "value": "{{sourcePostId}}" },
        { "label": "Author Handle", "value": "{{sourceAuthorHandle}}" },
        { "label": "Capture Method", "value": "{{captureMethod}}" },
        { "label": "Capture Tool Version", "value": "{{captureToolVersion}}" },
        { "label": "Capture Timestamp", "value": "{{captureTimestamp}}" }
      ]},
      { "type": "keyValue", "title": "Integrity Verification", "entries": [
        { "label": "Hash Algorithm", "value": "{{hashAlgorithm}}" },
        { "label": "Original Hash (SHA-256)", "value": "{{hashSha256}}" },
        { "label": "Verification Result", "value": "{{verificationResult}}" },
        { "label": "Verified By", "value": "{{verifiedBy}}" },
        { "label": "Verified At", "value": "{{verifiedAt}}" }
      ]},
      { "type": "text", "title": "Chain of Custody", "content": "{{custodyTimeline}}" },
      { "type": "text", "title": "Officer Declaration", "content": "I, {{officerName}}, hereby declare that the above evidence was collected in accordance with established OSINT procedures and ISO 27037 digital evidence handling standards. The evidence has not been altered, modified, or tampered with since the time of collection.\n\nSignature: ____________________\nBadge/ID: {{officerBadge}}\nDate: {{declarationDate}}" }
    ],
    "footer": { "text": "CONFIDENTIAL — Law Enforcement Use Only", "pageNumbers": true }
  }'::jsonb,
  '{
    "placeholders": [
      { "name": "caseId", "type": "string", "required": true },
      { "name": "evidenceRef", "type": "string", "required": true },
      { "name": "reportDate", "type": "date", "required": true },
      { "name": "sourcePlatform", "type": "string", "required": true },
      { "name": "sourceUrl", "type": "string", "required": false },
      { "name": "sourcePostId", "type": "string", "required": false },
      { "name": "sourceAuthorHandle", "type": "string", "required": false },
      { "name": "captureMethod", "type": "string", "required": true },
      { "name": "captureToolVersion", "type": "string", "required": false },
      { "name": "captureTimestamp", "type": "date", "required": true },
      { "name": "hashAlgorithm", "type": "string", "required": true },
      { "name": "hashSha256", "type": "string", "required": true },
      { "name": "verificationResult", "type": "string", "required": true },
      { "name": "verifiedBy", "type": "string", "required": false },
      { "name": "verifiedAt", "type": "date", "required": false },
      { "name": "custodyTimeline", "type": "string", "required": false },
      { "name": "officerName", "type": "string", "required": true },
      { "name": "officerBadge", "type": "string", "required": true },
      { "name": "declarationDate", "type": "date", "required": true }
    ]
  }'::jsonb,
  true
)
ON CONFLICT DO NOTHING;
