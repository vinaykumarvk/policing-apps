-- Migration 055: Platform Cooperation Framework
-- Preservation/production requests, platform responses, legal templates

-- Platform preservation/production request table
CREATE TABLE IF NOT EXISTS platform_preservation_request (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_ref TEXT NOT NULL,
  platform TEXT NOT NULL,
  case_id UUID REFERENCES case_record(case_id),
  alert_id UUID REFERENCES sm_alert(alert_id),
  request_type TEXT NOT NULL CHECK (request_type IN ('PRESERVATION', 'PRODUCTION', 'EMERGENCY_DISCLOSURE', 'TAKEDOWN')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'FULFILLED', 'REJECTED', 'EXPIRED')),
  target_accounts JSONB DEFAULT '[]',
  target_content JSONB DEFAULT '[]',
  legal_authority TEXT,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  generated_document_url TEXT,
  created_by UUID NOT NULL REFERENCES user_account(user_id),
  unit_id UUID REFERENCES organization_unit(unit_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS sm_platform_req_ref_seq START WITH 1;
CREATE INDEX IF NOT EXISTS idx_platform_req_status ON platform_preservation_request(status);
CREATE INDEX IF NOT EXISTS idx_platform_req_case ON platform_preservation_request(case_id);

-- Platform response table
CREATE TABLE IF NOT EXISTS platform_response (
  response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES platform_preservation_request(request_id),
  response_type TEXT NOT NULL CHECK (response_type IN ('ACKNOWLEDGEMENT', 'PARTIAL_FULFILLMENT', 'FULL_FULFILLMENT', 'REJECTION')),
  response_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_ref TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_response_request ON platform_response(request_id);

-- Legal template table
CREATE TABLE IF NOT EXISTS legal_template (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  platform TEXT,
  template_body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed generic preservation request template
INSERT INTO legal_template (template_name, template_type, platform, template_body, variables) VALUES
(
  'Generic Preservation Request',
  'PRESERVATION',
  NULL,
  'To: {{platformLegalTeam}}
Date: {{requestDate}}
Re: Preservation Request — {{requestRef}}

Dear Legal Compliance Team,

Pursuant to {{legalAuthority}}, I am writing to request the preservation of records associated with the following account(s) and/or content on your platform:

**Target Accounts**: {{targetAccounts}}
**Target Content**: {{targetContent}}

This preservation request is made in connection with an ongoing investigation (Case Ref: {{caseRef}}).

Please preserve all records, including but not limited to:
- Account registration information
- Login/access logs
- Content posted (including deleted content)
- Private messages
- IP addresses and session data
- Payment information

This preservation request is valid from {{validFrom}} until {{validUntil}}.

Please confirm receipt of this request at your earliest convenience.

Sincerely,
{{officerName}}
{{officerTitle}}
{{organizationName}}
{{contactInfo}}',
  '["platformLegalTeam","requestDate","requestRef","legalAuthority","targetAccounts","targetContent","caseRef","validFrom","validUntil","officerName","officerTitle","organizationName","contactInfo"]'::jsonb
)
ON CONFLICT DO NOTHING;
