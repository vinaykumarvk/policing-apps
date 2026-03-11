# DOPAMS UI -- Comprehensive UI/UX Quality Review

**Date:** 2026-03-11
**Scope:** `apps/dopams-ui/src/` -- all views, components, charts, CSS, locale files, App.tsx
**Verdict:** **AT-RISK**

---

## Executive Summary

The DOPAMS UI is a substantial application with 41+ views, 8 chart components, a design-system CSS layer with 13+ custom themes, and four locale files (en, hi, pa, te). The overall architecture is solid -- lazy-loaded views, design tokens, responsive table-to-card patterns, offline-awareness, and accessible tab patterns are all present. However, there are several CRITICAL and HIGH findings that must be resolved before production release:

- **Punjabi locale is severely incomplete** (~240 keys missing vs en.ts), and is not even loadable via the i18n module
- **Hardcoded hex colors** appear across 8 files (40 instances) instead of design tokens
- **Clickable table rows lack keyboard navigation** across 6+ views
- **DashboardFilters component references 15+ i18n keys that do not exist** in any locale file
- **SubjectDetail.tsx is ~68KB** -- a massive single-file component

| Category | CRITICAL | HIGH | MEDIUM | LOW | Total |
|----------|----------|------|--------|-----|-------|
| Accessibility | 1 | 2 | 2 | 0 | 5 |
| Responsive Design | 0 | 1 | 3 | 1 | 5 |
| i18n | 2 | 1 | 1 | 0 | 4 |
| Interaction States | 0 | 1 | 1 | 0 | 2 |
| Design System Integrity | 1 | 1 | 1 | 0 | 3 |
| Frontend Performance | 0 | 1 | 2 | 1 | 4 |
| **Total** | **4** | **7** | **10** | **2** | **23** |

---

## 1. Accessibility (WCAG 2.1 AA)

### A-01 [CRITICAL] Clickable table rows lack keyboard navigation

**Files:**
- `apps/dopams-ui/src/views/AlertList.tsx:113`
- `apps/dopams-ui/src/views/LeadList.tsx:110`
- `apps/dopams-ui/src/views/CaseList.tsx:103`
- `apps/dopams-ui/src/views/SubjectList.tsx:186`
- `apps/dopams-ui/src/views/ControlRoomDashboard.tsx:122`
- `apps/dopams-ui/src/views/SupervisorDashboard.tsx:114`
- `apps/dopams-ui/src/views/GeoDashboard.tsx:152`

All entity list views use `<tr className="entity-table__clickable" onClick={...}>` but provide no `tabIndex`, `role="button"`, `onKeyDown`, or `aria-label`. These rows are completely inaccessible to keyboard-only users and screen readers. This is the most common interactive pattern in the app and affects virtually every data table that links to a detail view.

**Fix:** Add `tabIndex={0}`, `role="link"`, `aria-label={descriptive text}`, and `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}` to every clickable `<tr>`.

---

### A-02 [HIGH] Hardcoded "Yes"/"No" strings in SubjectDetail BoolBadge

**File:** `apps/dopams-ui/src/views/SubjectDetail.tsx` (inline `BoolBadge` helper)

The `BoolBadge` helper function outputs hardcoded English "Yes"/"No" strings instead of using `t("common.yes")` / `t("common.no")`. This affects all boolean fields in the subject detail view, which displays dozens of boolean properties (financial_flag, is_kingpin, cross_border_activity, etc.).

**Fix:** Replace `"Yes"` / `"No"` with `t("common.yes")` / `t("common.no")`.

---

### A-03 [HIGH] AuditLog uses `ui-table` class instead of `entity-table`

**File:** `apps/dopams-ui/src/views/AuditLog.tsx:106`

The AuditLog view uses `<table className="ui-table">` instead of the standard `entity-table` class used everywhere else. The `entity-table` class has built-in mobile card layout support via `data-label` attributes and `<thead>` hiding. The `ui-table` class does not appear to be defined in app.css or design-system.css, meaning this table has no mobile-responsive behavior and will overflow horizontally on small screens.

**Fix:** Change `className="ui-table"` to `className="entity-table"`.

---

### A-04 [MEDIUM] Admin.tsx user table not wrapped in `table-scroll` div

**File:** `apps/dopams-ui/src/views/Admin.tsx:114`

The users table is rendered directly without a `<div className="table-scroll">` wrapper that is used consistently in other views. This means on desktop with many columns, horizontal overflow may not be handled gracefully.

**Fix:** Wrap with `<div className="table-scroll">`.

---

### A-05 [MEDIUM] SVG graph nodes lack keyboard interaction

**Files:**
- `apps/dopams-ui/src/views/NetworkGraph.tsx:153`
- `apps/dopams-ui/src/views/SubjectNetwork.tsx:480-490`
- `apps/dopams-ui/src/views/TransactionNetwork.tsx:664-675`

All three graph visualization components render SVG `<g>` elements with click handlers but without `tabIndex`, `role="button"`, or keyboard event handlers. Users who cannot use a mouse cannot interact with these visualizations.

**Fix:** At minimum, add a `tabIndex={0}` and `onKeyDown` handler to each interactive node group. Consider also providing an alternative list-based view of the graph data for accessibility.

---

## 2. Responsive Design

### R-01 [HIGH] Inline 2-column grid in detail views does not collapse on mobile

**Files:**
- `apps/dopams-ui/src/views/AlertDetail.tsx:242` -- translation panel
- `apps/dopams-ui/src/views/LeadDetail.tsx:223` -- translation panel
- `apps/dopams-ui/src/views/PendencyDashboard.tsx:130` -- bottleneck stat cards

These views use inline `style={{ gridTemplateColumns: "1fr 1fr" }}` which creates a rigid 2-column layout that does not collapse to a single column on mobile. Per CLAUDE.md guidelines, form/content grids must be single-column on mobile and only use multi-column at `min-width: 48rem`.

**Fix:** Use a CSS class with mobile-first single-column default and a `@media (min-width: 48rem)` rule for the 2-column layout, or use `gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))"` for a fluid approach.

---

### R-02 [MEDIUM] Non-standard breakpoint in login.css

**File:** `apps/dopams-ui/src/login.css:211`

Uses `@media (max-width: 30rem)` which is not one of the three sanctioned breakpoint tokens (`22.5rem`, `48rem`, `80rem`). Per CLAUDE.md, only these three tokens should be used.

**Fix:** Replace with `@media (max-width: 48rem)` or `@media (max-width: 22.5rem)` depending on intent.

---

### R-03 [MEDIUM] SubjectNetwork detail panel uses fixed 280px grid column

**File:** `apps/dopams-ui/src/views/SubjectNetwork.tsx:424`

Uses inline `style={{ gridTemplateColumns: selectedNode ? "1fr 280px" : "1fr" }}`. On narrow mobile screens, a fixed 280px column will cause overflow or leave very little space for the main SVG canvas.

**Fix:** Use a CSS class with a responsive approach: stack the detail panel below the canvas on mobile, side-by-side only on `min-width: 48rem`.

---

### R-04 [MEDIUM] NetworkGraph uses hardcoded WIDTH=700, HEIGHT=500

**File:** `apps/dopams-ui/src/views/NetworkGraph.tsx:25`

Unlike SubjectNetwork and TransactionNetwork which use ResizeObserver for responsive SVG sizing, the older NetworkGraph component uses hardcoded `const WIDTH = 700, HEIGHT = 500`. While the SVG uses `viewBox` and `width: 100%`, the force simulation is calibrated to these fixed dimensions and won't adapt to narrow viewports.

**Fix:** Add a ResizeObserver like the other two graph components.

---

### R-05 [LOW] QueryAssistant sticky form bar missing safe-area-inset-bottom

**File:** `apps/dopams-ui/src/views/QueryAssistant.tsx:101`

The sticky bottom input bar uses `position: sticky; bottom: 0` but does not include `padding-bottom: env(safe-area-inset-bottom)`. On iOS devices with a home indicator, the submit button may be partially obscured.

**Fix:** Add `paddingBottom: "max(var(--space-3), env(safe-area-inset-bottom))"`.

---

## 3. i18n

### I-01 [CRITICAL] Punjabi (pa) locale file is severely incomplete

**File:** `apps/dopams-ui/src/locales/pa.ts`

The Punjabi locale has approximately 647 keys compared to approximately 890 in en.ts -- a shortfall of ~240 keys (~27%). Entire sections are missing:

- All `reports.*` keys (reports.title, reports.content, reports.evidence, etc.)
- All `ingestion.*` keys (ingestion.title, ingestion.tab_sources, etc.)
- All `admin_hub.*` keys (admin_hub.title, admin_hub.group_ingestion, etc.)
- Most `timeline.*` keys
- `detail.tab_crime_history`
- `common.remove`
- Many `login.*` keys (login.remember_me, login.forgot_password, etc.)
- All `ewa.*` keys (early warning)
- All `legal.*` keys
- All `templates.*` keys
- All `report_gen.*` keys
- Many `network.*` and `txn_network.*` keys

Any user selecting Punjabi as their secondary language will see raw i18n keys rendered for these sections.

**Fix:** Complete the pa.ts locale file with translations for all keys present in en.ts.

---

### I-02 [CRITICAL] Punjabi locale is not registered in i18n.ts loader

**File:** `apps/dopams-ui/src/i18n.ts:22-25`

The `localeLoaders` map only contains entries for `hi` and `te`. The `pa` locale has a file at `locales/pa.ts` but is never registered, meaning `ensureLocaleLoaded("pa")` will silently return without loading the Punjabi translations. Additionally, `pa` is not listed in the `SECONDARY_LANGUAGES` array, so it does not appear as a selectable language option in the UI.

**Fix:** Add `pa: () => import("./locales/pa")` to `localeLoaders` and add `{ code: "pa", label: "\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40 (Punjabi)" }` to `SECONDARY_LANGUAGES`.

---

### I-03 [HIGH] DashboardFilters uses 15+ i18n keys that do not exist

**File:** `apps/dopams-ui/src/components/DashboardFilters.tsx`

The DashboardFilters component references the following i18n keys that are not defined in any of the four locale files (en, hi, pa, te):

- `dashboard.preset_today`, `dashboard.preset_7d`, `dashboard.preset_30d`, `dashboard.preset_90d`
- `dashboard.filter_from`, `dashboard.filter_to`
- `dashboard.filter_district`, `dashboard.filter_priority`
- `dashboard.priority_critical`, `dashboard.priority_high`, `dashboard.priority_medium`, `dashboard.priority_low`
- `dashboard.granularity_daily`, `dashboard.granularity_weekly`, `dashboard.granularity_monthly`

This component is used by LeadershipDashboard and GeoDashboard. Users will see raw key names like `dashboard.preset_today` rendered in the UI.

**Fix:** Add all missing keys to all four locale files.

---

### I-04 [MEDIUM] Settings theme selector shows raw English theme names

**File:** `apps/dopams-ui/src/views/Settings.tsx:31`

Custom theme names are rendered with basic `charAt(0).toUpperCase() + slice(1)` instead of i18n keys. Theme names like "rolex", "nord", "dracula", "gruvbox" etc. appear in English regardless of selected language.

**Fix:** Create i18n keys for each theme name or accept this as cosmetic (theme names are proper nouns).

---

## 4. Interaction States

### IS-01 [HIGH] Missing :active states for dashboard chart elements

**Files:**
- `apps/dopams-ui/src/views/GeoDashboard.tsx:77-91` -- district tile buttons
- `apps/dopams-ui/src/views/EarlyWarningDashboard.tsx:176-179` -- show more/less link buttons

The district tile buttons in GeoDashboard use `className="filter-chip"` with custom inline styles but the `filter-chip` class in app.css does not have a `:active` state defined. The `link-btn` class used by the NPS expand/collapse buttons also has no `:active` state. Per CLAUDE.md, every `:hover` style must have a corresponding `:active` style since hover is invisible on touch devices.

**Fix:** Add `:active` states to `.filter-chip` and `.link-btn` classes in app.css.

---

### IS-02 [MEDIUM] ReportGenerateHub AI report generation lacks progress indicator

**File:** `apps/dopams-ui/src/views/ReportGenerateHub.tsx`

The AI report generation tab (lines ~450-650 in the persisted output) shows a loading spinner while generating, but for long-running LLM operations there is no progress bar, estimated time, or intermediate status. The user sees only "Generating..." with no feedback on whether the operation is progressing or stalled.

**Fix:** Consider adding a progress indicator or at minimum a "This may take 30-60 seconds" message for LLM-based report generation.

---

## 5. Design System Integrity

### DS-01 [CRITICAL] Hardcoded hex colors across 8 files (40 instances)

**Files (with instance counts):**
- `apps/dopams-ui/src/views/ControlRoomDashboard.tsx` -- 5 instances
- `apps/dopams-ui/src/views/LeadershipDashboard.tsx` -- 11 instances
- `apps/dopams-ui/src/views/SupervisorDashboard.tsx` -- 6 instances
- `apps/dopams-ui/src/views/PendencyDashboard.tsx` -- 3 instances
- `apps/dopams-ui/src/views/GeoDashboard.tsx` -- 5 instances
- `apps/dopams-ui/src/views/EarlyWarningDashboard.tsx` -- 1 instance
- `apps/dopams-ui/src/charts/DonutChart.tsx` -- 1 instance (COLORS array)
- `apps/dopams-ui/src/app.css` -- 8 instances (timeline nodes)

Hardcoded hex values like `#8b5cf6`, `#f97316`, `#06b6d4`, `#dc2626`, `#ef4444`, `#f59e0b`, `#3b82f6`, `#10b981`, `#ec4899`, `#991b1b` are used for chart colors, timeline nodes, funnel stages, and priority color maps. These do not adapt to theme changes (the app supports 13+ custom themes plus light/dark/system).

The most impactful instances are in the dashboard views where chart colors, funnel stages, and aging buckets all use hardcoded values. When a user switches to the "dracula" or "nord" theme, these colors remain fixed while the rest of the UI adapts, creating visual inconsistency.

**Fix:** Define a chart color palette as CSS custom properties in design-system.css (e.g., `--chart-color-1` through `--chart-color-8`) and reference them from JS. Provide overrides in each theme.

---

### DS-02 [HIGH] Inconsistent inline styles vs CSS classes

**Files:** Multiple -- especially dashboard views, detail views, and admin views.

Many views use extensive inline `style={{...}}` objects for layout that should be CSS classes. Examples:

- `SubjectNetwork.tsx:424` -- `style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: selectedNode ? "1fr 280px" : "1fr" }}`
- `LeadershipDashboard.tsx:111` -- `style={{ marginBottom: "var(--space-4)", gridTemplateColumns: "repeat(2, 1fr)" }}`
- `DetectionDictionary.tsx:353` -- `style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--space-3)" }}`

While these do use design tokens for spacing, the inline styles make it impossible to apply responsive overrides via media queries.

**Fix:** Extract repeated inline layout patterns into reusable CSS classes in app.css.

---

### DS-03 [MEDIUM] Mixed table class usage

**Files:**
- `apps/dopams-ui/src/views/AuditLog.tsx:106` -- uses `className="ui-table"`
- `apps/dopams-ui/src/views/DrugDashboard.tsx:65` -- no `table-scroll` wrapper
- `apps/dopams-ui/src/views/ModelAdmin.tsx:83` -- no `table-scroll` wrapper
- `apps/dopams-ui/src/views/Admin.tsx:114` -- no `table-scroll` wrapper

Most views consistently use `entity-table` with a `table-scroll` wrapper for responsive overflow handling. Several views deviate from this pattern, creating inconsistent table behavior across the app.

**Fix:** Standardize all tables to use `entity-table` class with `table-scroll` wrapper.

---

## 6. Frontend Performance

### P-01 [HIGH] SubjectDetail.tsx is ~68KB single component

**File:** `apps/dopams-ui/src/views/SubjectDetail.tsx`

This file is approximately 68KB -- the largest single component in the entire app. It contains:
- The main detail view with 10+ tabs
- An inline `BoolBadge` helper
- Crime history timeline rendering
- Financial analysis sections
- Transaction summaries
- Network analysis tab (lazy-loaded, good)
- Dozens of detail field renderings

This file exceeds reasonable single-component size limits and will:
- Increase bundle size for the chunk
- Be difficult to maintain and review
- Cause longer parse times on low-end devices

**Fix:** Extract logical sections (crime timeline, financial analysis, transaction summary) into separate components. Keep the tab shell in SubjectDetail.tsx.

---

### P-02 [MEDIUM] ReportGenerateHub.tsx is 1051 lines

**File:** `apps/dopams-ui/src/views/ReportGenerateHub.tsx`

At 1051 lines, this is the second-largest view component. It contains 5 tab panels (dossiers, interrogation, monthly, MIS, AI reports) each with their own state and data fetching logic. All state is declared at the top level regardless of which tab is active.

**Fix:** Extract each tab panel into its own component to enable independent state management and better code splitting.

---

### P-03 [MEDIUM] Force simulation runs on every node count/edge change

**Files:**
- `apps/dopams-ui/src/views/SubjectNetwork.tsx:232-309`
- `apps/dopams-ui/src/views/TransactionNetwork.tsx:197-270`

Both graph components restart the force simulation whenever `nodes.size` or `edges.size` changes, using `requestAnimationFrame` with up to 150 iterations. Each iteration calls `setNodes()` which triggers a React re-render of the entire SVG. On a graph with many nodes, this creates 150 re-renders in rapid succession.

**Fix:** Use a `ref` for the simulation state and batch updates, or use `useRef` for positions and only sync to React state every N frames. Alternatively, render the SVG imperatively outside React's render cycle.

---

### P-04 [LOW] Recharts imported for simple sparkline/gauge charts

**Files:**
- `apps/dopams-ui/src/charts/Sparkline.tsx` -- imports recharts for a single line
- `apps/dopams-ui/src/charts/GaugeChart.tsx` -- pure CSS, no recharts (good)

The Sparkline component imports `LineChart`, `Line`, and `ResponsiveContainer` from recharts to render a tiny inline chart that is essentially a single polyline. The GaugeChart demonstrates that pure CSS/SVG approaches work well for simple visualizations. Recharts is a substantial library (~250KB minified) and is the largest dependency for just the 4 chart components that use it (Sparkline, DonutChart, TrendLineChart, and the MiniBarChart/StackedBarChart/FunnelChart which were not checked but likely use recharts too).

**Fix:** For Sparkline, consider replacing with a simple inline SVG `<polyline>` (similar to GaugeChart's pure approach). This would remove recharts from the critical path for dashboard views that only show sparklines.

---

## Summary of Findings by Severity

### CRITICAL (4)
1. **A-01** -- Clickable table rows lack keyboard navigation (6+ views)
2. **I-01** -- Punjabi locale file is ~27% incomplete (~240 keys missing)
3. **I-02** -- Punjabi locale is not registered in i18n.ts loader
4. **DS-01** -- Hardcoded hex colors across 8 files (40 instances)

### HIGH (7)
1. **A-02** -- Hardcoded "Yes"/"No" in SubjectDetail BoolBadge
2. **A-03** -- AuditLog uses non-existent `ui-table` class
3. **I-03** -- DashboardFilters references 15+ missing i18n keys
4. **R-01** -- Inline 2-column grids don't collapse on mobile
5. **IS-01** -- Missing :active states for interactive chart elements
6. **DS-02** -- Inconsistent inline styles vs CSS classes
7. **P-01** -- SubjectDetail.tsx is ~68KB single component

### MEDIUM (10)
1. **A-04** -- Admin.tsx user table not wrapped in table-scroll
2. **A-05** -- SVG graph nodes lack keyboard interaction
3. **R-02** -- Non-standard breakpoint in login.css
4. **R-03** -- SubjectNetwork detail panel uses fixed 280px column
5. **R-04** -- NetworkGraph uses hardcoded dimensions
6. **I-04** -- Settings theme selector shows raw English theme names
7. **IS-02** -- AI report generation lacks progress indicator
8. **DS-03** -- Mixed table class usage
9. **P-02** -- ReportGenerateHub.tsx is 1051 lines
10. **P-03** -- Force simulation causes excessive re-renders

### LOW (2)
1. **R-05** -- QueryAssistant sticky bar missing safe-area-inset-bottom
2. **P-04** -- Recharts imported for simple sparkline chart

---

## What the Codebase Does Well

1. **Lazy loading**: All 30+ views are lazy-loaded via `React.lazy()` with Suspense fallbacks
2. **Design tokens**: Spacing, border-radius, and shadows consistently use CSS custom properties
3. **Table card pattern**: Most tables use `data-label` attributes for mobile card conversion
4. **Offline awareness**: `isOffline` prop is threaded through every view and mutation buttons are disabled
5. **Tab accessibility**: Tab bars consistently use `role="tablist"`, `role="tab"`, and `aria-selected`
6. **Skip links**: Login.tsx includes a skip-to-main link
7. **Theme support**: 13+ custom themes with proper CSS custom property overrides
8. **Error boundaries**: ErrorBoundary wraps the entire app with i18n support
9. **dvh usage**: No `100vh` found anywhere -- the codebase uses `dvh` correctly
10. **Table scroll wrappers**: Most tables wrapped in `table-scroll` for horizontal overflow

---

## Final Verdict: **AT-RISK**

The DOPAMS UI has a solid architectural foundation but the 4 CRITICAL findings must be resolved before production deployment:

1. The keyboard navigation gap on clickable table rows is a WCAG 2.1 AA violation that affects the primary user workflow
2. The Punjabi locale is both incomplete and not loadable, making the app non-functional for Punjabi-language users
3. The 40 hardcoded hex colors will cause visual inconsistency across the 13+ supported themes

A focused remediation sprint addressing the 4 CRITICAL and 7 HIGH findings (estimated 2-3 days) would bring this to PASS status.
