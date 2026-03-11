# DOPAMS UI Code Quality Review

**Date:** 2026-03-11
**Scope:** `apps/dopams-ui/src/` (React SPA frontend)
**Reviewer:** Claude Opus 4.6 (automated)

---

## Verdict: **AT-RISK**

The DOPAMS UI is functionally comprehensive with 41 views, solid i18n coverage for en/hi/te, and proper loading/error/empty state handling in most views. However, several CRITICAL and HIGH findings around type safety, code duplication, oversized components, and missing locale translations (Punjabi has 211 missing keys) present real maintainability and correctness risks that must be addressed before the next release.

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 10    |
| MEDIUM   | 11    |
| LOW      | 6     |
| **Total**| **29**|

---

## 1. Auth (`useAuth.ts`)

### C-01 [CRITICAL] `authHeaders()` return type is `RequestInit` but 37 of 39 consumers declare it as `() => Record<string, string>`

**File:** `apps/dopams-ui/src/useAuth.ts:48`

`authHeaders()` returns `RequestInit` (an object with a nested `headers` property):

```ts
const authHeaders = useCallback((): RequestInit => {
  const token = localStorage.getItem(STORAGE_TOKEN);
  return {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}, []);
```

But 37 out of 39 view components declare their Props type as:

```ts
authHeaders: () => Record<string, string>;
```

Only `ReportGenerateHub.tsx:8` correctly declares `() => RequestInit`.

**Impact:** This mismatch means TypeScript cannot catch bugs at call sites. The actual runtime behavior works because views call `fetch(url, { ...authHeaders(), method: "POST" })` which spreads the `RequestInit` object -- but any view that tries to use the return value as flat headers (e.g., `headers: authHeaders()`) would produce `{ headers: { headers: { ... } } }` -- a silent auth failure.

**Fix:** Either change `authHeaders()` to return `Record<string, string>` (just the headers object), or update all Props types to `() => RequestInit`.

---

### M-01 [MEDIUM] Token stored in localStorage without expiry validation

**File:** `apps/dopams-ui/src/useAuth.ts:9-14`

`getStoredAuth()` reads the token from `localStorage` and uses it immediately without checking JWT expiry. The session-verify call on mount (line 59-73) is fire-and-forget -- the stale token is used in the meantime. If the `/auth/me` endpoint is slow or offline, expired tokens will be sent on initial requests.

**Fix:** Decode the JWT `exp` claim before returning from `getStoredAuth()`. If expired, clear storage and return null.

---

### M-02 [MEDIUM] Logout fire-and-forget with no error surface

**File:** `apps/dopams-ui/src/useAuth.ts:36-42`

The logout function calls the server endpoint but `.catch()`-es any failure silently. The local state is always cleared regardless. If the server-side session/token is not invalidated, it remains valid until TTL.

**Fix:** This is acceptable for UX but should log to an audit-visible sink, not just `console.warn`.

---

## 2. Types (`types.ts`)

### H-01 [HIGH] `SubjectProfile` uses `string` for all enum-like fields -- no union types

**File:** `apps/dopams-ui/src/types.ts`

The `SubjectProfile` interface has ~220 fields. Fields like `severity`, `priority`, `state_id`, `offender_status`, `threat_level`, `supply_chain_position`, `operational_level`, `quantity_category`, `custody_status`, and `bail_status` are all typed as `string` or `string | null` rather than discriminated union types. This prevents TypeScript from catching invalid values and eliminates autocomplete.

**Fix:** Define union types for enumerated fields (e.g., `type ThreatLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"`) and use them in the interface.

---

### H-02 [HIGH] Pervasive use of `any` type in view components

**Files (partial list):**
- `apps/dopams-ui/src/views/AlertDetail.tsx` -- `classification: any`, `legalMappings: any[]`, `payload_jsonb: any`
- `apps/dopams-ui/src/views/LeadDetail.tsx` -- same pattern
- `apps/dopams-ui/src/views/CaseDetail.tsx` -- `payload: any`
- `apps/dopams-ui/src/views/ControlRoomDashboard.tsx` -- API response as `any`
- `apps/dopams-ui/src/views/LeadershipDashboard.tsx` -- API response as `any`

At least 8 views use `any` for API response data. This defeats type safety for the most critical data paths.

**Fix:** Define response interfaces matching the API contract (e.g., `ClassificationResult`, `LegalMapping`, `DashboardPayload`).

---

### M-03 [MEDIUM] `apiBaseUrl` defaults to empty string when env var is missing

**File:** `apps/dopams-ui/src/types.ts`

```ts
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
```

An empty string causes API calls to go to the current origin, which may silently serve HTML instead of JSON. No runtime warning is emitted.

**Fix:** Log a warning in development when the env var is unset, or use a more explicit fallback.

---

## 3. App Setup (`App.tsx`)

### L-01 [LOW] App.tsx is ~700 lines with inline route matching and nav configuration

**File:** `apps/dopams-ui/src/App.tsx`

The file contains route configuration, nav items, role-based filtering, the main layout shell, and the view-switching `renderView()` function all in one file. While it works, it makes onboarding and maintenance harder.

**Fix:** Extract route config, nav items, and the role-based filter into separate modules.

---

### L-02 [LOW] Hash-based routing without a router library may cause edge cases

**File:** `apps/dopams-ui/src/App.tsx`

The app uses `parseHash`/`buildHash` from `@puda/shared` for client-side routing. This is adequate for the current use case but makes deep-linking, route guards, and nested routes harder to implement if scope grows.

**Fix:** No immediate action required; note for future architecture planning.

---

## 4. Views

### C-02 [CRITICAL] `DrugDashboard` useEffect has empty dependency array but uses `authHeaders` and `isOffline`

**File:** `apps/dopams-ui/src/views/DrugDashboard.tsx`

```tsx
useEffect(() => {
  if (isOffline) return;
  fetch(`${apiBaseUrl}/api/v1/subjects/drug-dashboard`, authHeaders())
    .then(...)
}, []);  // <-- missing authHeaders, isOffline
```

The `useEffect` captures `authHeaders` and `isOffline` in its closure but lists `[]` as dependencies. If the user logs out and back in with a different account, the old token is still used. If the network goes offline, the effect does not re-run when connectivity returns. React's exhaustive-deps lint rule would flag this.

**Fix:** Add `[authHeaders, isOffline]` to the dependency array, or use a ref-based pattern if you intentionally want mount-only behavior.

---

### H-03 [HIGH] Massive code duplication across 4 detail views (notes, activity, transitions)

**Files:**
- `apps/dopams-ui/src/views/AlertDetail.tsx` (~315 lines)
- `apps/dopams-ui/src/views/CaseDetail.tsx` (~223 lines)
- `apps/dopams-ui/src/views/LeadDetail.tsx` (~297 lines)
- `apps/dopams-ui/src/views/ReportDetail.tsx` (~193 lines)

All four views implement nearly identical patterns:
1. Fetch entity + transitions on mount
2. Notes tab with add-note form
3. Activity tab with timeline
4. Transition form with select + remarks + submit

The notes, activity, and transition sections are copy-pasted with only entity-type and endpoint differences.

**Fix:** Extract a `useEntityDetail(entityType, id)` hook and `<NotesPanel>`, `<ActivityTimeline>`, `<TransitionForm>` components.

---

### H-04 [HIGH] `facetOptions` helper duplicated identically across 4 list views

**Files:**
- `apps/dopams-ui/src/views/AlertList.tsx`
- `apps/dopams-ui/src/views/CaseList.tsx`
- `apps/dopams-ui/src/views/LeadList.tsx`
- `apps/dopams-ui/src/views/SubjectList.tsx`

Each file defines the same `facetOptions()` helper function that converts facet counts into `<option>` elements with count suffixes.

**Fix:** Extract `facetOptions()` to a shared utility module (e.g., `utils/facetOptions.ts`).

---

### H-05 [HIGH] Force-directed graph simulation duplicated between SubjectNetwork and TransactionNetwork

**Files:**
- `apps/dopams-ui/src/views/SubjectNetwork.tsx` (~619 lines)
- `apps/dopams-ui/src/views/TransactionNetwork.tsx` (~742 lines)

Both files implement custom SVG-based force-directed graph simulation with drag, pan, zoom, node selection, and legend. The physics engine, drag handlers, and SVG rendering are near-identical. Combined, this is ~1,360 lines of duplicated graph code.

**Fix:** Extract a `<ForceGraph>` component with configurable node/edge renderers and reuse it in both views.

---

### H-06 [HIGH] SubjectDetail.tsx is excessively large (~800+ lines)

**File:** `apps/dopams-ui/src/views/SubjectDetail.tsx`

This file defines inline helper components (`DetailField`, `ArrayChips`, `BoolBadge`, `ProgressBar`), a `computeCompleteness()` function, a `CrimeHistoryTimeline` sub-component, and the main `SubjectDetail` component with 15+ collapsible sections and 4 tabs.

**Fix:** Extract `DetailField`, `ArrayChips`, `BoolBadge`, `ProgressBar` to `components/`. Extract `CrimeHistoryTimeline` to its own view/component. Split the section renderers into separate modules.

---

### H-07 [HIGH] MonitoringConfig.tsx has ~40 individual useState calls

**File:** `apps/dopams-ui/src/views/MonitoringConfig.tsx` (~625 lines)

This component manages three CRUD entities (profiles, locations, keywords) with create/edit/delete modals. Each entity set has its own cluster of state variables: `items`, `loading`, `error`, `showCreate`, `editItem`, `form fields`, etc. This makes state transitions error-prone and the component hard to reason about.

**Fix:** Use `useReducer` with a discriminated-union action type, or split into three sub-components each managing one CRUD entity.

---

### H-08 [HIGH] No AbortController cleanup on fetch useEffects

**Files (systemic -- affects most views):**
- `apps/dopams-ui/src/views/AlertList.tsx`
- `apps/dopams-ui/src/views/CaseList.tsx`
- `apps/dopams-ui/src/views/SubjectDetail.tsx`
- `apps/dopams-ui/src/views/Dashboard.tsx`
- `apps/dopams-ui/src/views/DrugDashboard.tsx`
- (and ~20 more views)

Nearly all views that fetch data on mount do not create an `AbortController` or return a cleanup function from `useEffect`. If a user navigates away before the fetch completes, `setState` is called on an unmounted component. While React 18 is lenient about this, it still wastes bandwidth and can cause subtle state bugs with Strict Mode double-rendering.

**Fix:** Add `AbortController` with cleanup:
```tsx
useEffect(() => {
  const ac = new AbortController();
  fetch(url, { ...authHeaders(), signal: ac.signal })
    .then(...)
    .catch(err => { if (!ac.signal.aborted) setError(err.message); });
  return () => ac.abort();
}, [deps]);
```

---

### H-09 [HIGH] DetectionDictionary.tsx is oversized at ~651 lines managing 3 tab panes

**File:** `apps/dopams-ui/src/views/DetectionDictionary.tsx`

Manages slang entries, keywords, and emoji codes with full CRUD, batch actions, sorting, and pagination in a single component. State management is complex with multiple interdependent state variables.

**Fix:** Split each tab pane (Slang, Keywords, Emoji) into its own sub-component.

---

### M-04 [MEDIUM] Silent error swallowing in classify and translate handlers

**Files:**
- `apps/dopams-ui/src/views/AlertDetail.tsx` -- `catch { /* silent */ }` on classify and translate
- `apps/dopams-ui/src/views/LeadDetail.tsx` -- same pattern

When classification or translation fails, the error is silently swallowed. The user sees no feedback and may assume the operation succeeded.

**Fix:** Show a toast/alert message on failure, or at minimum set an error state.

---

### M-05 [MEDIUM] Hardcoded hex colors in dashboard views instead of CSS variables

**Files:**
- `apps/dopams-ui/src/views/ControlRoomDashboard.tsx` -- `"#3b82f6"`, `"#ef4444"`, `"#10b981"`, etc. in alertFunnel stages
- `apps/dopams-ui/src/views/LeadershipDashboard.tsx` -- `PRIORITY_COLORS`, `STAGE_COLORS`, `CATEGORY_COLORS` objects with hex values

These bypass the design system and will not respond to theme changes (light/dark).

**Fix:** Replace with `var(--color-info)`, `var(--color-danger)`, `var(--color-success)`, etc. from the design system.

---

### M-06 [MEDIUM] `<Field label={t(...)}>` anti-pattern used extensively in DOPAMS UI views

**Files (partial list -- 37 views affected):**
- `apps/dopams-ui/src/views/MonitoringConfig.tsx` (lines 357, 360, 366, 372, 383, 388, 393, ...)
- `apps/dopams-ui/src/views/ReportDetail.tsx` (lines 174, 182)
- `apps/dopams-ui/src/views/IngestionHub.tsx` (multiple)
- `apps/dopams-ui/src/views/DetectionDictionary.tsx` (multiple)
- `apps/dopams-ui/src/views/CourtExportWizard.tsx` (lines 63, 66, 69)
- `apps/dopams-ui/src/Login.tsx` (lines 110, 130, 141)
- And many more

Per CLAUDE.md, `<Field label={...}>` should use `<Bilingual tKey="...">` for labels, not `t("...")`. However, this guideline specifically applies to the **citizen app**, and DOPAMS UI is an internal officer-facing app. If bilingual rendering is not required for DOPAMS, this is informational only. If DOPAMS is intended to be bilingual, this is a HIGH-severity issue affecting 37+ views.

**Fix:** Clarify whether DOPAMS UI requires bilingual label rendering. If yes, convert all `<Field label={t(...)}>` to `<Field label={<Bilingual tKey="..." />}>`.

---

### M-07 [MEDIUM] ReportGenerateHub.tsx is extremely large (~1000+ lines)

**File:** `apps/dopams-ui/src/views/ReportGenerateHub.tsx`

This file manages 5 distinct report types (dossiers, interrogation, monthly, MIS analytics, AI reports) plus e-Court source configuration. Each report type has its own list/create/action logic.

**Fix:** Split into sub-components per report type: `<DossierTab>`, `<InterrogationTab>`, `<MonthlyTab>`, `<MisTab>`, `<AiReportTab>`, `<ECourtSources>`.

---

### M-08 [MEDIUM] AuditLog.tsx has hardcoded English option text

**File:** `apps/dopams-ui/src/views/AuditLog.tsx:82-85`

The entity type filter `<Select>` options use `t("audit.all_types")` for the default, but the individual option values are rendered from API data. If the API returns English strings like "Case", "Alert", "Task", "User", these will not be translated. However, since these come from the API, the proper fix depends on whether the API should return i18n keys or localized strings.

**Fix:** Map known entity types to i18n keys (e.g., `entityTypeI18n[type]` lookup), or accept that server-side labels are English-only for the admin audience.

---

### M-09 [MEDIUM] SubjectDetail BoolBadge has hardcoded "Yes"/"No"

**File:** `apps/dopams-ui/src/views/SubjectDetail.tsx`

```tsx
const BoolBadge = ({ value, label }: { value?: boolean | null; label?: string }) => {
  // ...
  {label ?? (value ? "Yes" : "No")}
};
```

This renders English "Yes"/"No" regardless of locale. The locale files have `common.yes` and `common.no` keys.

**Fix:** Replace with `{label ?? (value ? t("common.yes") : t("common.no"))}`.

---

### M-10 [MEDIUM] DashboardFilters component uses raw HTML elements instead of shared components

**File:** `apps/dopams-ui/src/components/DashboardFilters.tsx`

Uses raw `<input type="date">`, `<select>`, and `<button>` elements with custom CSS classes instead of the `<Input>`, `<Select>`, `<Button>` components from `@puda/shared`. This bypasses the design system's consistent styling and accessibility features.

**Fix:** Replace raw elements with shared component equivalents.

---

### L-03 [LOW] Settings.tsx displays custom theme names without i18n

**File:** `apps/dopams-ui/src/views/Settings.tsx`

The theme options use `t("settings.theme_light")` etc., which is correct. However, if custom themes are added via configuration, their names would not be translated.

**Fix:** No immediate action; note for future extensibility.

---

### L-04 [LOW] NetworkGraph and SubjectNetwork use hardcoded WIDTH/HEIGHT constants

**Files:**
- `apps/dopams-ui/src/views/SubjectNetwork.tsx` -- `const WIDTH = 900, HEIGHT = 600`
- `apps/dopams-ui/src/views/TransactionNetwork.tsx` -- `const WIDTH = 900, HEIGHT = 600`

These constants do not respond to container size changes, which may cause the graph to overflow or underutilize space on different screen sizes.

**Fix:** Use a `ResizeObserver` or `ref` to get the container's actual dimensions.

---

### L-05 [LOW] TemplateAdmin handleClone calls openEdit().then() incorrectly

**File:** `apps/dopams-ui/src/views/TemplateAdmin.tsx`

The `handleClone` function calls `openEdit(tmpl)` which is an async function that uses `await` internally, then chains `.then()` on the result. While this works because async functions return Promises, mixing `await` and `.then()` patterns makes the code harder to follow.

**Fix:** Use consistent async/await throughout.

---

## 5. Components

### L-06 [LOW] Only 2 shared components exist -- most reusable patterns are inline

**Files:**
- `apps/dopams-ui/src/components/EmptyState.tsx` (37 lines) -- well-typed, clean
- `apps/dopams-ui/src/components/DashboardFilters.tsx` (153 lines) -- functional but uses raw HTML elements

Many reusable patterns exist inline in views (e.g., `DetailField`, `ArrayChips`, `BoolBadge`, `ProgressBar` in SubjectDetail; `facetOptions` in all list views; force-directed graph in both network views) but are not extracted to the components directory.

**Fix:** As part of the duplication reduction effort (H-03, H-04, H-05, H-06), extract shared patterns to `components/`.

---

## 6. i18n (Locale Files)

### H-10 [HIGH] Punjabi locale (pa.ts) is missing 211 keys present in English

**File:** `apps/dopams-ui/src/locales/pa.ts` -- 612 keys vs 823 in `en.ts`

Missing key categories (211 keys total):
- **login** section: 10 keys (`login.remember_me`, `login.forgot_password`, `login.back_to_login`, `login.forgot_instructions`, `login.email_or_username`, `login.email_or_username_placeholder`, `login.send_reset_link`, `login.reset_link_sent`, `login.failed`, `login.footer_text`)
- **subjects** section: 3 keys (`subjects.more_filters`, `subjects.fewer_filters`, `subjects.clear_filters`)
- **common** section: 1 key (`common.remove`)
- **detail** section: 1 key (`detail.tab_crime_history`)
- **error** section: 2 keys (`error.reported_refresh`, `error.refresh_page`)
- **nav** section: 2 keys (`nav.report_hub`, `nav.report_templates`)
- **ewa** section: 3 keys (all early-warning age display)
- **legal** section: 1 key
- **templates** section: 6 keys (all template editor labels)
- **reports** section: 57 keys (entire Reports Hub section)
- **report_gen** section: 18 keys (entire AI report generation section)
- **timeline** section: 23 keys (entire Crime History Timeline)
- **admin_hub** section: 18 keys (entire Admin Hub navigation)
- **ingestion** section: 66 keys (entire Data Ingestion Hub)

Users switching to Punjabi will see raw i18n keys (e.g., `reports.title`, `ingestion.upload_btn`) instead of translated text across the Reports Hub, Admin Hub, Crime History, and Ingestion Hub views.

**Fix:** Add all 211 missing Punjabi translations to `pa.ts`.

---

### M-11 [MEDIUM] Hindi and Telugu locales have untranslated values for many keys

**Files:**
- `apps/dopams-ui/src/locales/hi.ts`
- `apps/dopams-ui/src/locales/te.ts`

While Hindi and Telugu have all 823 keys present, several sections (especially the older dashboard, alerts, leads, cases, inbox, transition, admin, filter, common, offline, sla, notifications, search, evidence, report, classify, legal, translate, query, graph, drug, models sections in Hindi) still have English values rather than translated text. For example, in `hi.ts`:

```ts
"dashboard.total_alerts": "Total Alerts",  // Should be Hindi
"alerts.title": "Alerts",                   // Should be Hindi
"audit.title": "Audit Trail",              // Should be Hindi
```

**Fix:** Professional translation review needed for all keys in hi.ts and te.ts that still contain English text.

---

## Summary Table

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| C-01 | CRITICAL | Auth | `authHeaders()` returns `RequestInit` but Props declare `Record<string, string>` |
| C-02 | CRITICAL | Views | DrugDashboard useEffect missing deps `[authHeaders, isOffline]` |
| H-01 | HIGH | Types | SubjectProfile uses `string` for all enum fields |
| H-02 | HIGH | Types | Pervasive `any` type in 8+ view components |
| H-03 | HIGH | Views | Notes/activity/transition code duplicated across 4 detail views |
| H-04 | HIGH | Views | `facetOptions` helper duplicated across 4 list views |
| H-05 | HIGH | Views | Force-directed graph duplicated between SubjectNetwork and TransactionNetwork |
| H-06 | HIGH | Views | SubjectDetail.tsx is 800+ lines with inline sub-components |
| H-07 | HIGH | Views | MonitoringConfig.tsx has ~40 useState calls |
| H-08 | HIGH | Views | No AbortController cleanup on fetch useEffects (systemic, ~25 views) |
| H-09 | HIGH | Views | DetectionDictionary.tsx oversized at 651 lines |
| H-10 | HIGH | i18n | Punjabi locale missing 211 of 823 keys |
| M-01 | MEDIUM | Auth | Token in localStorage without expiry check |
| M-02 | MEDIUM | Auth | Logout fire-and-forget |
| M-03 | MEDIUM | Types | `apiBaseUrl` defaults to empty string silently |
| M-04 | MEDIUM | Views | Silent error swallowing in classify/translate |
| M-05 | MEDIUM | Views | Hardcoded hex colors bypass design system |
| M-06 | MEDIUM | Views | `<Field label={t(...)}>` pattern -- assess bilingual need |
| M-07 | MEDIUM | Views | ReportGenerateHub.tsx ~1000+ lines |
| M-08 | MEDIUM | Views | AuditLog hardcoded English entity types |
| M-09 | MEDIUM | Views | BoolBadge hardcoded "Yes"/"No" |
| M-10 | MEDIUM | Components | DashboardFilters uses raw HTML instead of shared components |
| M-11 | MEDIUM | i18n | Hindi/Telugu have English values for many keys |
| L-01 | LOW | App | App.tsx is ~700 lines, could be split |
| L-02 | LOW | App | Hash-based routing limits future extensibility |
| L-03 | LOW | Views | Settings theme names not i18n-ready for custom themes |
| L-04 | LOW | Views | Graph views use hardcoded WIDTH/HEIGHT |
| L-05 | LOW | Views | TemplateAdmin mixes await and .then() |
| L-06 | LOW | Components | Only 2 shared components; many reusable patterns are inline |

---

## Recommended Fix Priority

### Immediate (before next release)
1. **C-01** -- Fix `authHeaders` type mismatch (either change return type or all Props)
2. **C-02** -- Fix DrugDashboard useEffect dependency array
3. **H-10** -- Add 211 missing Punjabi translations
4. **M-09** -- Fix BoolBadge hardcoded "Yes"/"No"

### Short-term (next sprint)
5. **H-03** -- Extract shared detail view components (NotesPanel, ActivityTimeline, TransitionForm)
6. **H-04** -- Extract `facetOptions` to shared utility
7. **H-08** -- Add AbortController cleanup to fetch useEffects (can be done incrementally)
8. **H-02** -- Define typed interfaces for API responses to replace `any`

### Medium-term (next 2 sprints)
9. **H-05** -- Extract shared ForceGraph component
10. **H-06** -- Split SubjectDetail into sub-components
11. **H-07** -- Refactor MonitoringConfig with useReducer or sub-components
12. **H-09** -- Split DetectionDictionary into tab sub-components
13. **H-01** -- Add union types for enum fields in SubjectProfile
14. **M-05** -- Replace hardcoded hex colors with CSS variables
15. **M-07** -- Split ReportGenerateHub into tab sub-components
16. **M-11** -- Professional translation review for Hindi/Telugu
