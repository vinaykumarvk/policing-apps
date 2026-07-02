# PUDA Citizen & Officer Platform — Functional Test Cases

| Field | Value |
|-------|-------|
| **Project** | PUDA Citizen Services Platform (Citizen App + Officer App) |
| **Document Type** | Functional Test Case Specification |
| **Version** | 1.0 |
| **Date** | 2026-03-13 |
| **Author** | QA Engineering Team |
| **BRD Reference** | 30 service-specific BRDs (`BRD_*.docx.md`) |
| **Technology Stack** | React (Frontend), Node.js / Fastify (API), PostgreSQL (DB) |
| **Total FRs Covered** | FR-01 through FR-20 (20 Functional Requirements) |
| **Total Test Cases** | 98 |

---

## 1. Test Case Summary

| FR ID | FR Title | TC Count | P1 | P2 | P3 |
|-------|----------|----------|----|----|-----|
| FR-01 | Authority Selection & Service Initiation | 5 | 2 | 2 | 1 |
| FR-02 | Online Application Form | 5 | 2 | 2 | 1 |
| FR-03 | Save Draft & Resume (incl. Offline Queue) | 6 | 3 | 2 | 1 |
| FR-04 | Document Upload | 5 | 2 | 2 | 1 |
| FR-05 | Mandatory Validations Before Submission | 4 | 2 | 1 | 1 |
| FR-06 | Submission Receipt Download | 5 | 2 | 2 | 1 |
| FR-07 | Applicant Dashboard & Application Withdrawal | 6 | 2 | 3 | 1 |
| FR-08 | Workflow Routing | 4 | 2 | 1 | 1 |
| FR-09 | Officer Inbox & Actions (incl. Batch Verify) | 6 | 3 | 2 | 1 |
| FR-10 | Query/Rework Loop | 5 | 2 | 2 | 1 |
| FR-11 | Inspection Capture & Visibility | 6 | 2 | 3 | 1 |
| FR-12 | Fee Payment Gateway | 6 | 3 | 2 | 1 |
| FR-13 | SLA Tracking & Escalation | 6 | 2 | 3 | 1 |
| FR-14 | Certificate/Order & Internal Notes | 5 | 2 | 2 | 1 |
| FR-15 | Notifications (SLA alerts, badges) | 5 | 2 | 2 | 1 |
| FR-16 | Search by ARN/Applicant/Status | 4 | 1 | 2 | 1 |
| FR-17 | Reason Codes & Assisted Channel | 5 | 2 | 2 | 1 |
| FR-18 | CSV/Excel Export | 3 | 1 | 1 | 1 |
| FR-19 | Configurable SLA Timers | 4 | 1 | 2 | 1 |
| FR-20 | Audit Trail | 3 | 2 | 1 | 0 |
| **TOTAL** | | **98** | **40** | **39** | **19** |

Priority distribution: P1=41%, P2=40%, P3=19%

---

## 2. Test Cases by Functional Requirement

### FR-01: Authority Selection & Service Initiation

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR01-001 | FR-01 AC-01 | Verify authority picker shows all 4 authorities (PUDA, GMADA, GLADA, BDA) | 1. Citizen logged in 2. On "Create Application" page 3. Service selected | 1. Navigate to Create Application 2. Observe authority picker dropdown 3. Expand dropdown | Authority Select shows 4 options: PUDA, GMADA, GLADA, BDA. Each label includes full name (e.g., "PUDA — Punjab Urban Development Authority"). Default is empty (no pre-selection). | P1 |
| TC-PUDA-FR01-002 | FR-01 AC-02 | Verify selected authority is persisted in form data and sent to API | 1. Citizen logged in 2. Service "Change of Ownership" selected | 1. Select "GMADA" from authority picker 2. Fill required fields 3. Click "Save Draft" 4. Check API request payload | Request body includes `authority_id: "GMADA"`. Saved draft reflects selected authority. | P1 |
| TC-PUDA-FR01-003 | FR-01 AC-03 | Verify authority picker is disabled when offline | 1. Citizen logged in 2. Device offline | 1. Navigate to Create Application while offline 2. Observe authority picker | Authority dropdown is disabled with offline indicator. | P2 |
| TC-PUDA-FR01-004 | FR-01 AC-04 | Verify authority picker labels are bilingual (EN/HI/PA) | 1. Citizen logged in 2. Language set to Hindi | 1. Navigate to Create Application 2. Observe authority picker label | Label shows "Authority / Development Body" in English AND "प्राधिकरण / विकास निकाय" in Hindi. | P2 |
| TC-PUDA-FR01-005 | FR-01 EC-01 | Verify submission is blocked without authority selection | 1. Citizen on Create Application 2. All fields filled EXCEPT authority | 1. Leave authority picker as "Select authority..." 2. Attempt to submit | Form validation prevents submission. Authority field flagged as required. | P3 |

---

### FR-02: Online Application Form

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR02-001 | FR-02 AC-01 | Verify service-specific form renders from service pack config | 1. Citizen logged in 2. Service "Change of Ownership" selected | 1. Select service from catalog 2. Wait for form to load 3. Verify form fields match `service-packs/change_of_ownership/form.json` | FormRenderer displays all pages/fields from form.json. Field types (text, select, date) render correctly. | P1 |
| TC-PUDA-FR02-002 | FR-02 AC-02 | Verify form is read-only when offline | 1. Citizen logged in 2. Application in progress 3. Device goes offline | 1. Open existing draft while offline 2. Attempt to modify fields | All form fields are read-only. Save Draft and Submit buttons show appropriate offline state. | P1 |
| TC-PUDA-FR02-003 | FR-02 AC-03 | Verify multi-page form navigation | 1. Service with multi-page form (e.g., building_plan) | 1. Fill page 1 fields 2. Click "Next" 3. Fill page 2 fields 4. Click "Back" | Navigation between pages preserves entered data. Progress indicator shows current page. | P2 |
| TC-PUDA-FR02-004 | FR-02 AC-04 | Verify document step appears after form when service has document types | 1. Service "Change of Ownership" has document types configured | 1. Complete form fields 2. Click "Next Step" 3. Observe documents step | Documents step appears with required/optional document types from `documents.json`. Step indicator shows document step. | P2 |
| TC-PUDA-FR02-005 | FR-02 EC-01 | Verify form validation on required fields | 1. Service form has required fields | 1. Leave required fields empty 2. Click Submit | Validation errors appear on empty required fields. Form does not submit. Error messages are bilingual. | P3 |

---

### FR-03: Save Draft & Resume (incl. Offline Queue)

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR03-001 | FR-03 AC-01 | Verify Save Draft creates draft application via API | 1. Citizen logged in 2. Profile complete 3. Form partially filled | 1. Fill some form fields 2. Click "Save Draft" 3. Check API response | POST to `/api/v1/applications` succeeds. Response includes `arn`, `state_id: "DRAFT"`, `rowVersion`. Toast shows success. | P1 |
| TC-PUDA-FR03-002 | FR-03 AC-02 | Verify Save Draft works when offline (C6 fix) | 1. Citizen logged in 2. Device offline 3. Profile complete | 1. Fill form fields while offline 2. Click "Save Draft" | Draft saved to localStorage via `writeOfflineDraft()`. Toast shows "Draft saved locally — will sync when online". Save Draft button is NOT disabled when offline. | P1 |
| TC-PUDA-FR03-003 | FR-03 AC-03 | Verify offline drafts auto-sync on reconnect | 1. One or more offline drafts saved 2. Device goes back online | 1. Save 2 drafts while offline 2. Go back online 3. Wait for sync | Auto-sync fires. Each offline draft POSTed to API. Toast: "Synced 2 offline draft(s)". Pending sync count drops to 0. Drafts removed from localStorage. | P1 |
| TC-PUDA-FR03-004 | FR-03 AC-04 | Verify draft conflict detection (409) | 1. Draft saved 2. Another session modifies same draft | 1. Open draft in session A 2. Save changes in session B 3. Save changes in session A | Session A receives 409 conflict. Conflict modal appears offering "Keep Current Form" or "Reload Latest Draft". | P2 |
| TC-PUDA-FR03-005 | FR-03 AC-05 | Verify pending sync count banner | 1. Offline drafts exist 2. Device is online | 1. Save draft while offline 2. Go online before sync completes 3. Check dashboard | Alert banner shows "N draft(s) waiting to sync" with count. | P2 |
| TC-PUDA-FR03-006 | FR-03 EC-01 | Verify failed sync marks draft as attempted (no infinite retry) | 1. Offline draft saved 2. API returns 400 error on sync | 1. Save invalid draft offline 2. Go online 3. Auto-sync fires and fails | Failed draft marked as `synced: true` (attempted). Not retried on subsequent syncs. Error does not crash the app. | P3 |

---

### FR-04: Document Upload

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR04-001 | FR-04 AC-01 | Verify mandatory documents enforced before submission | 1. Service has mandatory document types 2. Application in DRAFT | 1. Navigate to documents step 2. Upload some but not all mandatory documents 3. Attempt to submit | Submission blocked. Missing mandatory documents highlighted. Error message is bilingual. | P1 |
| TC-PUDA-FR04-002 | FR-04 AC-02 | Verify document upload with progress bar | 1. Application in DRAFT 2. Online | 1. Click upload button for a document type 2. Select a PDF file 3. Observe upload progress | Upload progress bar shows 0-100%. On completion, document appears in the list with filename and timestamp. | P1 |
| TC-PUDA-FR04-003 | FR-04 AC-03 | Verify document upload blocked when offline | 1. Device offline | 1. Navigate to document upload 2. Attempt to upload | Upload button disabled. Message: "Document upload is unavailable while offline." | P2 |
| TC-PUDA-FR04-004 | FR-04 AC-04 | Verify document re-upload during query/rework | 1. Application returned with QUERY 2. Officer requested additional documents | 1. Open application with active query 2. Navigate to documents 3. Upload requested documents | New documents uploaded successfully. Document list updated. | P2 |
| TC-PUDA-FR04-005 | FR-04 EC-01 | Verify large file handling | 1. Application in DRAFT | 1. Attempt to upload file > 10MB (if limit exists) | Either upload succeeds (if allowed) or clear error message about file size limit. No silent failure. | P3 |

---

### FR-05: Mandatory Validations Before Submission

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR05-001 | FR-05 AC-01 | Verify profile completeness check before draft save | 1. Citizen logged in 2. Profile incomplete (missing required fields) | 1. Fill form 2. Click "Save Draft" | Save blocked. Feedback shows "Complete your profile first" with list of missing fields. | P1 |
| TC-PUDA-FR05-002 | FR-05 AC-02 | Verify all mandatory form fields validated | 1. Service form with required fields | 1. Leave mandatory fields empty 2. Click Submit | Validation errors on each empty required field. Submit is blocked until all required fields filled. | P1 |
| TC-PUDA-FR05-003 | FR-05 BR-01 | Verify NDC payment status checked before certificate | 1. Service is "No Due Certificate" 2. Property selected | 1. Select property 2. System checks payment status | If dues pending: shows installment table, blocks submission until payment. If no dues: enables submission. | P2 |
| TC-PUDA-FR05-004 | FR-05 EC-01 | Verify duplicate application detection | 1. Citizen has existing application for same service+property | 1. Start new application for same service 2. Select same property | Warning banner: "You already have an application for this service." User can proceed or go back. | P3 |

---

### FR-06: Submission Receipt Download

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR06-001 | FR-06 AC-01 | Verify receipt download button appears for submitted applications | 1. Citizen logged in 2. Application state != DRAFT | 1. Open submitted application detail 2. Look for receipt button | "Download Receipt" button visible in the detail header. Not shown for DRAFT applications. | P1 |
| TC-PUDA-FR06-002 | FR-06 AC-02 | Verify receipt content includes required fields | 1. Submitted application exists | 1. Click "Download Receipt" 2. Inspect generated receipt | Receipt contains: Authority name, ARN, service name, applicant name, submission date, current status, disclaimer text. | P1 |
| TC-PUDA-FR06-003 | FR-06 AC-03 | Verify receipt is printable/saveable as PDF | 1. Receipt opened in new tab | 1. Click "Print / Save as PDF" in receipt tab 2. Use browser print dialog | Browser print dialog opens. Receipt renders cleanly in print layout. Action button hidden in print. | P2 |
| TC-PUDA-FR06-004 | FR-06 AC-04 | Verify receipt labels are bilingual | 1. Language set to Punjabi | 1. Click "Download Receipt" | Receipt labels show in both English and the selected regional language (Punjabi). | P2 |
| TC-PUDA-FR06-005 | FR-06 EC-01 | Verify receipt works when offline (no API needed) | 1. Application detail cached 2. Device offline | 1. Click "Download Receipt" while offline | Receipt generates from cached data. No API call needed (client-side generation). | P3 |

---

### FR-07: Applicant Dashboard & Application Withdrawal

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR07-001 | FR-07 AC-01 | Verify dashboard shows application list with status | 1. Citizen logged in 2. Has 3+ applications in various states | 1. Navigate to dashboard 2. Inspect application cards | Dashboard shows all applications with ARN, service name, status badge, submission date. | P1 |
| TC-PUDA-FR07-002 | FR-07 AC-02 | Verify dashboard works with cached data when offline | 1. Dashboard data previously loaded 2. Device offline | 1. Navigate to dashboard while offline | Shows cached applications with stale data banner: "Showing cached data (time)". | P1 |
| TC-PUDA-FR07-003 | FR-07 AC-03 | Verify application withdrawal for DRAFT applications (C3 fix) | 1. Citizen has DRAFT application | 1. Open DRAFT application detail 2. Click "Withdraw Application" 3. Confirm in dialog | Confirmation modal appears. On confirm, DELETE request sent. Application removed from list. Success toast shown. | P2 |
| TC-PUDA-FR07-004 | FR-07 AC-04 | Verify withdrawal confirmation prevents accidental deletion | 1. DRAFT application open | 1. Click "Withdraw Application" 2. Click "Cancel" in confirmation dialog | Application is NOT deleted. User returns to detail view. | P2 |
| TC-PUDA-FR07-005 | FR-07 AC-05 | Verify withdrawal button only shown for DRAFT state | 1. Submitted application (state != DRAFT) | 1. Open submitted application detail | "Withdraw Application" button is NOT visible. Only DRAFT applications show the withdrawal option. | P2 |
| TC-PUDA-FR07-006 | FR-07 EC-01 | Verify withdrawal blocked when offline | 1. Device offline 2. DRAFT application open | 1. Click "Withdraw Application" while offline | Button is disabled or withdrawal is blocked with offline message. | P3 |

---

### FR-08: Workflow Routing

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR08-001 | FR-08 AC-01 | Verify application routed to correct role after submission | 1. Service "Change of Ownership" configured 2. Citizen submits application | 1. Submit application 2. Check API: task assignment | Task created with `system_role_id` matching first workflow state's actor type. State transitions from DRAFT to first pending state. | P1 |
| TC-PUDA-FR08-002 | FR-08 AC-02 | Verify multi-stage routing (forward through roles) | 1. Officer at stage 1 forwards application | 1. Officer clicks FORWARD 2. Enters remarks 3. Submits | Application moves to next state. New task assigned to next role. Previous task marked complete. | P1 |
| TC-PUDA-FR08-003 | FR-08 BR-01 | Verify workflow states match service pack configuration | 1. Any service pack with workflow.json | 1. Submit application 2. Trace through all states to approval | State transitions match `workflow.json` definition. Each state's allowed actions match configuration. | P2 |
| TC-PUDA-FR08-004 | FR-08 EC-01 | Verify concurrent action handling (optimistic locking) | 1. Two officers open same task | 1. Officer A forwards task 2. Officer B tries to forward same task | Officer B receives conflict error. Task state preserved from Officer A's action. | P3 |

---

### FR-09: Officer Inbox & Actions (incl. Batch Verify)

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR09-001 | FR-09 AC-01 | Verify officer inbox displays assigned tasks | 1. Officer logged in 2. Has 5+ assigned tasks | 1. Navigate to inbox 2. Inspect task list | Inbox shows tasks with: ARN, service name, applicant name, SLA due date. Tasks sorted by assignment date. | P1 |
| TC-PUDA-FR09-002 | FR-09 AC-02 | Verify remarks required for ALL actions (O7 fix) | 1. Officer on task detail 2. Action selected (FORWARD, APPROVE, or REJECT) | 1. Select any action 2. Leave remarks empty 3. Click action button | Validation blocks action. Warning: "Remarks are required for all workflow actions." Remarks field highlighted. | P1 |
| TC-PUDA-FR09-003 | FR-09 AC-03 | Verify "Verify All Documents" batch button (O6 fix) | 1. Officer on task detail 2. Multiple unverified documents | 1. Click "Verify All Documents" 2. Wait for batch completion | All documents marked as VERIFIED. Button disabled after all verified. Success toast: "All documents verified." | P1 |
| TC-PUDA-FR09-004 | FR-09 AC-04 | Verify individual document verification still works | 1. Officer on task detail 2. Unverified documents | 1. Click verify button on single document | Individual document verified. Other documents remain unverified. | P2 |
| TC-PUDA-FR09-005 | FR-09 BR-01 | Verify batch verify button disabled when offline or all verified | 1. Officer offline OR all documents already verified | 1. Observe "Verify All Documents" button | Button is disabled. Correct state detected. | P2 |
| TC-PUDA-FR09-006 | FR-09 EC-01 | Verify action with empty/whitespace-only remarks is blocked | 1. Officer types only spaces in remarks | 1. Type "   " (spaces only) in remarks 2. Click APPROVE | Validation blocks action. `.trim()` removes whitespace. Remarks treated as empty. | P3 |

---

### FR-10: Query/Rework Loop

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR10-001 | FR-10 AC-01 | Verify officer can raise query on application | 1. Officer on task detail 2. Application in pending state | 1. Select "QUERY" action 2. Enter query message 3. Submit | Application state changes to query state. Citizen sees query in ApplicationDetail. | P1 |
| TC-PUDA-FR10-002 | FR-10 AC-02 | Verify citizen can respond to query | 1. Application has active query 2. Citizen logged in | 1. Open application with active query 2. Enter response message 3. Submit response | Response saved. Officer notified. Application returns to officer's inbox. | P1 |
| TC-PUDA-FR10-003 | FR-10 AC-03 | Verify query response blocked when offline | 1. Device offline 2. Application with active query | 1. Open application while offline 2. Check query response form | Response form hidden or disabled with offline message. | P2 |
| TC-PUDA-FR10-004 | FR-10 BR-01 | Verify query message is required (not empty) | 1. Officer on task detail 2. QUERY action selected | 1. Leave query message empty 2. Submit | Validation blocks. Error: "Query message is required." | P2 |
| TC-PUDA-FR10-005 | FR-10 EC-01 | Verify multiple query rounds | 1. Application queried, responded, queried again | 1. Officer raises query 2. Citizen responds 3. Officer raises second query | All queries and responses visible in timeline. Each query-response pair preserved. | P3 |

---

### FR-11: Inspection Capture & Visibility

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR11-001 | FR-11 AC-01 | Verify officer can view inspections for application (O1/O9) | 1. Officer on task detail 2. Application has scheduled inspections | 1. Scroll to "Site Inspection" section 2. Inspect inspection cards | Inspection cards show: type, status badge (color-coded), scheduled date. SCHEDULED inspections show "Assign to Me" button. | P1 |
| TC-PUDA-FR11-002 | FR-11 AC-02 | Verify officer can assign inspection to self | 1. Unassigned SCHEDULED inspection exists | 1. Click "Assign to Me" 2. Wait for API response | PATCH `/inspections/:id/assign` called. Inspection status shows "Assigned to you". Completion form appears. | P1 |
| TC-PUDA-FR11-003 | FR-11 AC-03 | Verify officer can complete inspection with outcome | 1. Inspection assigned to current officer | 1. Select outcome (PASS/FAIL/REINSPECTION/NA) 2. Enter findings summary 3. Enter outcome remarks 4. Click "Complete Inspection" | PATCH `/inspections/:id/complete` called. Status changes to COMPLETED. Read-only view shows outcome and findings. Success toast shown. | P2 |
| TC-PUDA-FR11-004 | FR-11 AC-04 | Verify citizen can see inspection status (C5 fix) | 1. Application has inspections 2. Citizen logged in | 1. Open application detail 2. Scroll to "Inspection Status" section | Read-only inspection cards show: type, status badge, scheduled date, outcome (if completed). No action buttons for citizen. | P2 |
| TC-PUDA-FR11-005 | FR-11 AC-05 | Verify officer can cancel inspection | 1. SCHEDULED or IN_PROGRESS inspection | 1. Click "Cancel Inspection" 2. Confirm cancellation | Inspection status changes to CANCELLED. Reflected in UI immediately. | P2 |
| TC-PUDA-FR11-006 | FR-11 EC-01 | Verify inspection actions disabled when offline | 1. Officer offline 2. Inspection section visible | 1. Check all inspection buttons while offline | "Assign to Me", "Complete Inspection", "Cancel Inspection" buttons are disabled. | P3 |

---

### FR-12: Fee Payment Gateway

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR12-001 | FR-12 AC-01 | Verify fee breakdown shown for fee-applicable services | 1. Service has `feeSchedule` in config (not NDC) 2. Application submitted | 1. Open application detail 2. Scroll to "Fee Payment" section | Fee breakdown card shows: description, amount for each line item, total. Uses service-pack fee config. | P1 |
| TC-PUDA-FR12-002 | FR-12 AC-02 | Verify "Pay Now" button initiates payment | 1. Fee demand exists with PENDING status | 1. Click "Pay Now" on a pending demand 2. Observe payment initiation | POST to `/api/v1/payments` called. Payment flow initiated. Button shows loading state during processing. | P1 |
| TC-PUDA-FR12-003 | FR-12 AC-03 | Verify completed payment status display | 1. Payment completed for a demand | 1. Open application detail 2. Check fee payment section | Completed demand shows green border and "Payment Completed" badge. Paid amount and remaining balance displayed. | P1 |
| TC-PUDA-FR12-004 | FR-12 AC-04 | Verify NDC payment flow remains separate | 1. Service is "No Due Certificate" | 1. Open NDC application 2. Check payment section | NDC-specific payment flow with installment ledger table is shown. Generic payment section does NOT appear for NDC. | P2 |
| TC-PUDA-FR12-005 | FR-12 AC-05 | Verify payment disabled when offline | 1. Device offline 2. Fee payment section visible | 1. Check "Pay Now" button while offline | Button disabled. Message: "Online payment is unavailable while offline." | P2 |
| TC-PUDA-FR12-006 | FR-12 EC-01 | Verify fee section not shown for services without fees | 1. Service has no `feeSchedule` in config | 1. Open application detail | Fee Payment section is not rendered. No empty/broken payment section. | P3 |

---

### FR-13: SLA Tracking & Escalation

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR13-001 | FR-13 AC-01 | Verify workload dashboard stats in officer inbox (O4 fix) | 1. Officer logged in 2. Has tasks with various SLA states | 1. Navigate to inbox 2. Inspect stats panel at top | Four stat cards: "Total Pending" (count), "Overdue" (red count), "Due in 24h" (amber count), "On Track" (green count). Computed from task `sla_due_at` fields. | P1 |
| TC-PUDA-FR13-002 | FR-13 AC-02 | Verify SLA badges on inbox task cards (O8 fix) | 1. Officer has overdue tasks and tasks due soon | 1. Navigate to inbox 2. Inspect individual task cards | Overdue tasks have red "OVERDUE" badge. Tasks due within 24h have amber "DUE SOON" badge. On-track tasks have green badge. | P1 |
| TC-PUDA-FR13-003 | FR-13 AC-03 | Verify "Overdue First" sort toggle | 1. Mixed SLA statuses in inbox | 1. Click "Overdue First" button 2. Observe task order | Overdue tasks sorted to top, then due-soon, then on-track. Within each bucket, sorted by soonest due first. Button shows active state. | P2 |
| TC-PUDA-FR13-004 | FR-13 AC-04 | Verify stats update on mobile (responsive) | 1. Officer on mobile device (< 48rem) | 1. Open inbox on mobile 2. Check stats panel layout | Stats cards render in 2x2 grid (not 4-column). All content visible without horizontal scroll. | P2 |
| TC-PUDA-FR13-005 | FR-13 BR-01 | Verify tasks without SLA counted as "on track" | 1. Tasks with null `sla_due_at` | 1. Check workload stats 2. Check SLA badge | Tasks with no SLA due date counted in "On Track" bucket. No badge shown or green "On Track" badge. | P2 |
| TC-PUDA-FR13-006 | FR-13 EC-01 | Verify SLA calculations handle timezone correctly | 1. Task with `sla_due_at` near midnight boundary | 1. Check SLA status at boundary times | SLA comparison uses consistent timezone. No off-by-one at midnight. | P3 |

---

### FR-14: Certificate/Order & Internal Notes

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR14-001 | FR-14 AC-01 | Verify output download link for approved applications | 1. Application in APPROVED state 2. Output generated | 1. Open approved application in citizen app 2. Check for output download | Download link/button visible for certificate/order. Clicking downloads the output PDF. | P1 |
| TC-PUDA-FR14-002 | FR-14 AC-02 | Verify officer can add internal notes (O5 fix) | 1. Officer on task detail 2. Application not in terminal state | 1. Scroll to "Internal Notes" section 2. Type a note 3. Click "Add Note" | Note saved via POST to API. Appears in notes list with officer ID and timestamp. Success toast shown. | P1 |
| TC-PUDA-FR14-003 | FR-14 AC-03 | Verify existing notes displayed in chronological order | 1. Multiple notes exist on application | 1. Open task detail 2. Scroll to notes section | Notes displayed in chronological order with officer name/ID and timestamp for each. | P2 |
| TC-PUDA-FR14-004 | FR-14 BR-01 | Verify internal notes NOT visible to citizen | 1. Officer added internal notes 2. Citizen opens same application | 1. Citizen opens application detail 2. Check timeline/notes sections | Internal notes are NOT shown to citizen. Only query messages and status changes visible. | P2 |
| TC-PUDA-FR14-005 | FR-14 EC-01 | Verify add note blocked on terminal state applications | 1. Application in APPROVED or REJECTED terminal state | 1. Open completed application in officer view 2. Check notes section | Note entry form is hidden. Existing notes visible as read-only. | P3 |

---

### FR-15: Notifications (SLA alerts, badges)

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR15-001 | FR-15 AC-01 | Verify notification bell with unread count (O3 fix) | 1. Officer logged in 2. Unread notifications exist | 1. Check app bar 2. Locate notification bell icon | Bell icon visible with red badge showing unread count. Count matches actual unread notifications from API. Capped at "99+" for large counts. | P1 |
| TC-PUDA-FR15-002 | FR-15 AC-02 | Verify notification polling every 60 seconds | 1. Officer logged in and online | 1. Wait 60+ seconds 2. Generate a new notification via another action | Unread count updates without manual refresh. Polling interval is 60 seconds. | P1 |
| TC-PUDA-FR15-003 | FR-15 AC-03 | Verify SLA warning toast on first notification load | 1. Officer has SLA-related notifications | 1. Log in as officer 2. Wait for first notification load | One-time toast: "N application(s) approaching or past SLA deadline". Toast only fires once per session. | P2 |
| TC-PUDA-FR15-004 | FR-15 AC-04 | Verify notifications not polled when offline | 1. Device offline | 1. Go offline 2. Wait 60+ seconds | No notification API calls made. No errors in console. Unread count preserved from last online value. | P2 |
| TC-PUDA-FR15-005 | FR-15 EC-01 | Verify bell button navigates to inbox | 1. Officer on any view | 1. Click notification bell | Navigation changes to inbox view. | P3 |

---

### FR-16: Search by ARN/Applicant/Status

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR16-001 | FR-16 AC-01 | Verify search by ARN returns exact match | 1. Officer logged in 2. Known ARN exists | 1. Navigate to Search 2. Enter ARN 3. Submit search | Exact match returned. Application detail accessible from result. | P1 |
| TC-PUDA-FR16-002 | FR-16 AC-02 | Verify search by applicant name (fuzzy match) | 1. Applications with various applicant names | 1. Search by partial name | Results include fuzzy matches. Relevant applications listed. | P2 |
| TC-PUDA-FR16-003 | FR-16 AC-03 | Verify search results exportable | 1. Search returns results | 1. Perform search 2. Click export button (if available) | Results exported as CSV or displayed in exportable table. | P2 |
| TC-PUDA-FR16-004 | FR-16 EC-01 | Verify empty search returns meaningful message | 1. Officer logged in | 1. Submit empty search 2. Submit search with no results | Empty search: validation message. No results: "No applications found" message. | P3 |

---

### FR-17: Reason Codes & Assisted Channel

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR17-001 | FR-17 AC-01 | Verify reason code dropdown appears for REJECT action (O2 fix) | 1. Officer on task detail 2. REJECT action selected | 1. Select REJECT action 2. Check action form | Reason code dropdown appears with options: "Incomplete Documents", "Policy Violation", "Incorrect Information", "Other". Label is bilingual. | P1 |
| TC-PUDA-FR17-002 | FR-17 AC-02 | Verify reason code dropdown for QUERY action | 1. Officer on task detail 2. QUERY action selected | 1. Select QUERY action 2. Check action form | Reason code dropdown with options: "Missing Document", "Clarification Needed", "Additional Information Required", "Other". | P1 |
| TC-PUDA-FR17-003 | FR-17 AC-03 | Verify reason code sent with action request | 1. REJECT action with reason code selected | 1. Select "Policy Violation" reason 2. Enter remarks 3. Submit REJECT | API request body includes `reasonCode: "policy_violation"` alongside remarks. | P2 |
| TC-PUDA-FR17-004 | FR-17 AC-04 | Verify assisted channel info shown to citizens (C2 fix) | 1. Citizen on dashboard | 1. Navigate to dashboard 2. Look for assisted channel information | Info alert visible: "You can also file applications through PUDA Facilitation Centers or Common Service Centers (CSC)." Text is bilingual. | P2 |
| TC-PUDA-FR17-005 | FR-17 EC-01 | Verify reason code dropdown not shown for FORWARD/APPROVE | 1. Officer selects FORWARD or APPROVE action | 1. Select FORWARD 2. Check action form | No reason code dropdown appears. Only remarks textarea shown. | P3 |

---

### FR-18: CSV/Excel Export

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR18-001 | FR-18 AC-01 | Verify search results can be exported to CSV | 1. Officer search returns results | 1. Perform search 2. Click export/download button | CSV file downloads with search results. Columns include: ARN, service, applicant, status, date. | P1 |
| TC-PUDA-FR18-002 | FR-18 AC-02 | Verify export handles large result sets | 1. Search returns 100+ results | 1. Export large result set | Export completes without timeout. File contains all results. | P2 |
| TC-PUDA-FR18-003 | FR-18 EC-01 | Verify export with no results | 1. Search returns 0 results | 1. Attempt export | Export disabled or shows message "No data to export." | P3 |

---

### FR-19: Configurable SLA Timers

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR19-001 | FR-19 AC-01 | Verify SLA calculation uses working days (excludes weekends/holidays) | 1. SLA set to 5 working days 2. Application submitted on Friday | 1. Submit application 2. Check `sla_due_at` computation | Due date skips weekends and configured holidays. 5 working days from Friday = next Friday (if no holidays). | P1 |
| TC-PUDA-FR19-002 | FR-19 AC-02 | Verify SLA displayed on officer task card | 1. Task with `sla_due_at` set | 1. View task in officer inbox | SLA due date shown on task card. Overdue/due-soon badges calculated correctly. | P2 |
| TC-PUDA-FR19-003 | FR-19 BR-01 | Verify per-stage SLA from workflow configuration | 1. Service has stage-specific SLA in workflow.json | 1. Trace application through stages 2. Check SLA recalculation at each stage | Each stage calculates its own SLA from the workflow config. Stage transitions reset the SLA timer. | P2 |
| TC-PUDA-FR19-004 | FR-19 EC-01 | Verify SLA behavior when no SLA configured for a stage | 1. Workflow stage with no SLA definition | 1. Application enters stage without SLA | `sla_due_at` is null. Task shows no SLA badge. Counted as "On Track" in dashboard. | P3 |

---

### FR-20: Audit Trail

| TC ID | FR Ref | Test Description | Pre-conditions | Test Steps | Expected Result | Priority |
|-------|--------|------------------|----------------|------------|-----------------|----------|
| TC-PUDA-FR20-001 | FR-20 AC-01 | Verify all state transitions logged in audit trail | 1. Application goes through multiple states | 1. Submit application 2. Officer forwards 3. Next officer approves 4. Check audit trail | Timeline/audit trail shows all transitions with: actor, action, timestamp, remarks. SHA256 chain integrity maintained. | P1 |
| TC-PUDA-FR20-002 | FR-20 AC-02 | Verify audit trail visible in officer task detail | 1. Application with history | 1. Open task detail 2. Scroll to timeline section | Timeline section shows chronological list of all events: submissions, forwards, queries, responses, approvals. | P1 |
| TC-PUDA-FR20-003 | FR-20 BR-01 | Verify audit entries include officer/citizen identity | 1. Multiple actors have touched application | 1. Inspect audit trail entries | Each entry includes actor ID, role, and action taken. No anonymous entries. | P2 |

---

## 3. Traceability Matrix

| FR ID | FR Title | AC Count | BR Count | TC Count | Coverage |
|-------|----------|----------|----------|----------|----------|
| FR-01 | Authority Selection & Service Initiation | 4 | 0 | 5 | Full |
| FR-02 | Online Application Form | 4 | 0 | 5 | Full |
| FR-03 | Save Draft & Resume (incl. Offline Queue) | 5 | 0 | 6 | Full |
| FR-04 | Document Upload | 4 | 0 | 5 | Full |
| FR-05 | Mandatory Validations | 2 | 1 | 4 | Full |
| FR-06 | Submission Receipt Download | 4 | 0 | 5 | Full |
| FR-07 | Dashboard & Withdrawal | 5 | 0 | 6 | Full |
| FR-08 | Workflow Routing | 2 | 1 | 4 | Full |
| FR-09 | Officer Inbox & Actions | 3 | 1 | 6 | Full |
| FR-10 | Query/Rework Loop | 3 | 1 | 5 | Full |
| FR-11 | Inspection Capture & Visibility | 5 | 0 | 6 | Full |
| FR-12 | Fee Payment Gateway | 5 | 0 | 6 | Full |
| FR-13 | SLA Tracking & Escalation | 4 | 1 | 6 | Full |
| FR-14 | Certificate/Order & Notes | 3 | 1 | 5 | Full |
| FR-15 | Notifications | 4 | 0 | 5 | Full |
| FR-16 | Search | 3 | 0 | 4 | Full |
| FR-17 | Reason Codes & Assisted Channel | 4 | 0 | 5 | Full |
| FR-18 | CSV/Excel Export | 2 | 0 | 3 | Full |
| FR-19 | Configurable SLA Timers | 2 | 1 | 4 | Full |
| FR-20 | Audit Trail | 2 | 1 | 3 | Full |
| **TOTAL** | | **70** | **8** | **98** | **Full** |
