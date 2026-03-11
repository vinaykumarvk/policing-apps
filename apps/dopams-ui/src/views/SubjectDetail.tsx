import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, MaskedField, Select, Tabs, Textarea, useToast, SkeletonBlock } from "@puda/shared";
import { apiBaseUrl, SubjectProfile, SubjectEntities } from "../types";

const SubjectNetwork = lazy(() => import("./SubjectNetwork"));

/* ---------- Inline helpers ---------- */

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-field">
      <span className="detail-field__label">{label}</span>
      <span className="detail-field__value">{value ?? "—"}</span>
    </div>
  );
}

function ArrayChips({ items }: { items: string[] | undefined | null }) {
  if (!items || !Array.isArray(items) || items.length === 0) return <span>—</span>;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
      {items.map((v, i) => <span key={i} className="badge badge--default">{v}</span>)}
    </span>
  );
}

function BoolBadge({ value, label }: { value: boolean | undefined | null; label?: string }) {
  const { t } = useTranslation();
  if (value === undefined || value === null) return <span>—</span>;
  return <span className={`badge badge--${value ? "success" : "default"}`}>{label ?? (value ? t("common.yes") : t("common.no"))}</span>;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <div style={{ flex: 1, height: "0.5rem", background: "var(--color-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", background: value >= 80 ? "var(--color-success)" : value >= 50 ? "var(--color-warning)" : "var(--color-error)", borderRadius: "var(--radius-sm)" }} />
      </div>
      <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{value}%</span>
    </div>
  );
}

/* ---------- Crime History Timeline ---------- */

type TimelineEventType = "fir" | "arrest" | "chargesheet" | "seizure" | "warrant" | "bail" | "verdict" | "hearing";

interface TimelineEvent {
  id: string;
  date: string;
  type: TimelineEventType;
  title: string;
  details: Array<{ label: string; value: string }>;
}

function buildTimelineEvents(
  subject: SubjectProfile,
  entities: SubjectEntities | null,
  t: (key: string) => string,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (entities?.fir_records) {
    for (const fir of entities.fir_records) {
      if (fir.fir_date) {
        events.push({
          id: `fir-${fir.fir_record_id}`,
          date: fir.fir_date,
          type: "fir",
          title: `${t("timeline.fir_registered")} — ${fir.fir_number}`,
          details: [
            ...(fir.police_station ? [{ label: t("subject.police_station"), value: fir.police_station }] : []),
            ...(fir.district ? [{ label: t("subject.district"), value: fir.district }] : []),
            ...(fir.sections_of_law?.length ? [{ label: t("subject.sections_of_law"), value: fir.sections_of_law.join(", ") }] : []),
            ...(fir.role_in_case ? [{ label: t("subject.role_in_case"), value: fir.role_in_case }] : []),
          ],
        });
      }
      if (fir.arrest_date) {
        events.push({
          id: `arrest-${fir.fir_record_id}`,
          date: fir.arrest_date,
          type: "arrest",
          title: `${t("timeline.arrested")} — ${fir.fir_number}`,
          details: [
            ...(fir.arresting_agency ? [{ label: t("subject.arresting_agency"), value: fir.arresting_agency }] : []),
            ...(fir.police_station ? [{ label: t("subject.police_station"), value: fir.police_station }] : []),
          ],
        });
      }
      if (fir.charge_sheet_date) {
        events.push({
          id: `cs-${fir.fir_record_id}`,
          date: fir.charge_sheet_date,
          type: "chargesheet",
          title: `${t("timeline.chargesheet_filed")} — ${fir.fir_number}`,
          details: [
            ...(fir.charge_sheet_number ? [{ label: t("subject.charge_sheet"), value: fir.charge_sheet_number }] : []),
            ...(fir.court_name ? [{ label: t("subject.court_name"), value: fir.court_name }] : []),
          ],
        });
      }
      if (fir.bail_date) {
        events.push({
          id: `bail-${fir.fir_record_id}`,
          date: fir.bail_date,
          type: "bail",
          title: `${t("timeline.bail_granted")} — ${fir.fir_number}`,
          details: [
            ...(fir.bail_type ? [{ label: t("subject.bail_type"), value: fir.bail_type }] : []),
            ...(fir.bail_conditions ? [{ label: t("timeline.conditions"), value: fir.bail_conditions }] : []),
          ],
        });
      }
      if (fir.verdict && fir.verdict !== "PENDING") {
        const verdictDate = fir.sentence_start_date || fir.charge_sheet_date || fir.fir_date;
        if (verdictDate) {
          events.push({
            id: `verdict-${fir.fir_record_id}`,
            date: verdictDate,
            type: "verdict",
            title: `${t("timeline.verdict")} — ${fir.verdict}`,
            details: [
              { label: t("subject.court_name"), value: fir.court_name || "—" },
              ...(fir.sentence_details ? [{ label: t("subject.sentence"), value: fir.sentence_details }] : []),
              ...(fir.fine_amount ? [{ label: t("timeline.fine"), value: `₹${fir.fine_amount.toLocaleString()}` }] : []),
            ],
          });
        }
      }
      if (fir.next_hearing_date) {
        events.push({
          id: `hearing-${fir.fir_record_id}`,
          date: fir.next_hearing_date,
          type: "hearing",
          title: `${t("timeline.next_hearing")} — ${fir.fir_number}`,
          details: [
            ...(fir.court_name ? [{ label: t("subject.court_name"), value: fir.court_name }] : []),
            ...(fir.case_stage ? [{ label: t("subject.case_stage"), value: fir.case_stage }] : []),
          ],
        });
      }
    }
  }

  if (entities?.seizure_records) {
    for (const sz of entities.seizure_records) {
      if (sz.seizure_date) {
        events.push({
          id: `seizure-${sz.seizure_id}`,
          date: sz.seizure_date,
          type: "seizure",
          title: `${t("timeline.seizure")} — ${sz.drug_type || t("timeline.substance")}`,
          details: [
            ...(sz.seizure_location ? [{ label: t("subject.seizure_location"), value: sz.seizure_location }] : []),
            ...(sz.gross_weight_grams ? [{ label: t("subject.gross_weight"), value: `${sz.gross_weight_grams}g` }] : []),
            ...(sz.quantity_category ? [{ label: t("subject.quantity_category"), value: sz.quantity_category }] : []),
            ...(sz.estimated_street_value ? [{ label: t("subject.street_value"), value: `₹${sz.estimated_street_value.toLocaleString()}` }] : []),
          ],
        });
      }
    }
  }

  if (entities?.warrant_records) {
    for (const w of entities.warrant_records) {
      if (w.warrant_date) {
        events.push({
          id: `warrant-${w.warrant_id}`,
          date: w.warrant_date,
          type: "warrant",
          title: `${t("timeline.warrant_issued")} — ${w.warrant_type}`,
          details: [
            { label: t("subject.warrant_number"), value: w.warrant_number },
            ...(w.issuing_court ? [{ label: t("subject.issuing_court"), value: w.issuing_court }] : []),
            { label: t("subject.warrant_status"), value: w.status },
          ],
        });
      }
    }
  }

  // Subject-level first arrest (if not already covered by FIR records)
  if (subject.first_arrested_at) {
    const firArrestDates = new Set(entities?.fir_records?.map(f => f.arrest_date).filter(Boolean));
    if (!firArrestDates.has(subject.first_arrested_at)) {
      events.push({
        id: "first-arrest",
        date: subject.first_arrested_at,
        type: "arrest",
        title: t("timeline.first_arrest"),
        details: [],
      });
    }
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return events;
}

const ALL_EVENT_TYPES: TimelineEventType[] = ["fir", "arrest", "chargesheet", "seizure", "warrant", "bail", "verdict", "hearing"];

function CrimeTimeline({ subject, entities, t }: { subject: SubjectProfile; entities: SubjectEntities | null; t: (key: string) => string }) {
  const [activeFilters, setActiveFilters] = useState<Set<TimelineEventType>>(new Set(ALL_EVENT_TYPES));

  const allEvents = useMemo(() => buildTimelineEvents(subject, entities, t), [subject, entities, t]);

  const filteredEvents = useMemo(
    () => allEvents.filter((e) => activeFilters.has(e.type)),
    [allEvents, activeFilters],
  );

  const toggleFilter = (type: TimelineEventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  if (allEvents.length === 0) {
    return (
      <div className="crime-timeline__empty">
        <svg className="crime-timeline__empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <p>{t("timeline.no_events")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="crime-timeline__filter-bar" role="group" aria-label={t("timeline.filter_label")}>
        {ALL_EVENT_TYPES.map((type) => {
          const count = allEvents.filter((e) => e.type === type).length;
          if (count === 0) return null;
          return (
            <button
              key={type}
              type="button"
              className={`crime-timeline__filter ${activeFilters.has(type) ? "crime-timeline__filter--active" : ""}`}
              onClick={() => toggleFilter(type)}
              aria-pressed={activeFilters.has(type)}
            >
              {t(`timeline.type_${type}`)} ({count})
            </button>
          );
        })}
      </div>

      <div className="crime-timeline" role="list" aria-label={t("timeline.title")}>
        {filteredEvents.map((event) => (
          <div key={event.id} className="crime-timeline__event" role="listitem">
            <div className={`crime-timeline__node crime-timeline__node--${event.type}`} />
            <div className="crime-timeline__date">
              {new Date(event.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </div>
            <div className="crime-timeline__card">
              <div className={`crime-timeline__type crime-timeline__type--${event.type}`}>
                {t(`timeline.type_${event.type}`)}
              </div>
              <div className="crime-timeline__title">{event.title}</div>
              {event.details.length > 0 && (
                <div className="crime-timeline__details">
                  {event.details.map((d, i) => (
                    <span key={i} className="crime-timeline__detail-item">
                      <span className="crime-timeline__detail-label">{d.label}:</span> {d.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */

type Props = {
  id: string;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onBack: () => void;
  onNavigate?: (view: string, id?: string) => void;
};

export default function SubjectDetail({ id, authHeaders, isOffline, onBack, onNavigate }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [subject, setSubject] = useState<SubjectProfile | null>(null);
  const [entities, setEntities] = useState<SubjectEntities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [availableTransitions, setAvailableTransitions] = useState<Array<{ transitionId: string; toStateId: string; label: string }>>([]);
  const [notes, setNotes] = useState<Array<{ note_id: string; note_text: string; created_by: string; created_at: string }>>([]);
  const [activity, setActivity] = useState<Array<{ event_id: string; event_type: string; actor_id: string; created_at: string; payload_jsonb?: any }>>([]);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  const fetchTransitions = () => {
    fetch(`${apiBaseUrl}/api/v1/subjects/${id}/transitions`, authHeaders())
      .then((r) => r.ok ? r.json() : { transitions: [] })
      .then((data) => setAvailableTransitions(data.transitions || []))
      .catch(() => setAvailableTransitions([]));
  };

  const fetchNotes = () => {
    fetch(`${apiBaseUrl}/api/v1/subjects/${id}/notes`, authHeaders())
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  };
  const fetchActivity = () => {
    fetch(`${apiBaseUrl}/api/v1/subjects/${id}/activity`, authHeaders())
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setActivity(data.events || data.activity || []))
      .catch(() => setActivity([]));
  };
  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/subjects/${id}/notes`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ note_text: newNote }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setNewNote("");
      fetchNotes();
      showToast("success", t("notes.added"));
    } catch { showToast("error", t("common.error")); }
    finally { setSubmittingNote(false); }
  };

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/subjects/${id}?include=entities`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setSubject(data.subject || data);
        if (data.entities) setEntities(data.entities);
        fetchTransitions(); fetchNotes(); fetchActivity();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subject"))
      .finally(() => setLoading(false));
  }, [id, authHeaders]);

  const handleTransition = async () => {
    if (!selectedTransition || isOffline) return;
    setTransitioning(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/subjects/${id}/transition`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ transitionId: selectedTransition, remarks }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const entityRes = await fetch(`${apiBaseUrl}/api/v1/subjects/${id}?include=entities`, authHeaders());
      if (entityRes.ok) { const d = await entityRes.json(); setSubject(d.subject || d); if (d.entities) setEntities(d.entities); }
      setSelectedTransition("");
      setRemarks("");
      fetchTransitions();
      showToast("success", t("transition.success"));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : t("transition.error"));
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!subject) return null;

  const s = subject;
  const ids = typeof s.identifiers === "object" && s.identifiers !== null ? s.identifiers as Record<string, string> : {};
  const gangAssociates = entities?.gang_associates || [];

  return (
    <>
      {/* ===== Header ===== */}
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} aria-label={t("detail.back")} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1>{s.full_name}</h1>
        <span className={`badge badge--${s.risk_score >= 7 ? "critical" : s.risk_score >= 4 ? "warning" : "low"}`}>
          Risk: {s.risk_score}
        </span>
        <span className={`badge badge--${s.offender_status === "CONVICTED" ? "critical" : s.offender_status === "ABSCONDING" ? "warning" : "default"}`}>
          {s.offender_status}
        </span>
        <span className={`badge badge--${s.cdr_status === "COMPLETED" ? "success" : s.cdr_status === "NOT_REQUESTED" ? "default" : "info"}`}>
          CDR: {s.cdr_status}
        </span>
        <span className="badge badge--default">{s.state_id}</span>
      </div>

      {/* Completeness bar */}
      <div style={{ margin: "var(--space-3) 0" }}>
        <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>{t("subject.completeness")}</span>
        <ProgressBar value={s.completeness_score ?? 0} />
      </div>

      <Tabs tabs={[
        { key: "details", label: t("detail.tab_details"), content: (
          <>
            {/* 1. Personal Information */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.personal_info")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subjects.name")} value={s.full_name} />
                <DetailField label={t("subject.father_name")} value={s.father_name} />
                <DetailField label={t("subject.mother_name")} value={s.mother_name} />
                <DetailField label={t("subject.spouse_name")} value={s.spouse_name} />
                <DetailField label={t("subjects.dob")} value={s.date_of_birth} />
                <DetailField label={t("subject.age")} value={s.age} />
                <DetailField label={t("subjects.gender")} value={s.gender} />
                <DetailField label={t("subject.nationality")} value={s.nationality} />
                <DetailField label={t("subject.religion")} value={s.religion} />
                <DetailField label={t("subject.caste")} value={s.caste} />
                <DetailField label={t("subject.education")} value={s.education} />
                <DetailField label={t("subject.occupation")} value={s.occupation} />
                <DetailField label={t("subject.marital_status")} value={s.marital_status} />
                <DetailField label={t("subject.known_languages")} value={<ArrayChips items={s.known_languages} />} />
              </div>
            </div>

            {/* 2. Case Context */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.case_context")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.district")} value={s.district} />
                <DetailField label={t("subject.police_station")} value={s.police_station} />
                <DetailField label={t("subject.crime_number")} value={s.crime_number} />
                <DetailField label={t("subject.section_of_law")} value={<ArrayChips items={s.section_of_law} />} />
              </div>
            </div>

            {/* 3. Identity Documents */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.identity_documents")}</h2>
              <div className="detail-grid">
                {ids.aadhaarHash && <MaskedField label={t("subject.aadhaar")} value={ids.aadhaarHash} />}
                {ids.panNumber && <MaskedField label={t("subject.pan")} value={ids.panNumber} />}
                <DetailField label={t("subject.ration_card")} value={s.ration_card_number} />
                <DetailField label={t("subject.passport")} value={s.passport_details ? JSON.stringify(s.passport_details) : null} />
                <DetailField label={t("subject.visa")} value={s.visa_details ? JSON.stringify(s.visa_details) : null} />
                <DetailField label={t("subject.driving_license")} value={s.driving_license_details ? JSON.stringify(s.driving_license_details) : null} />
                <DetailField label={t("subject.vehicle_rc")} value={Array.isArray(s.vehicle_rc_details) && s.vehicle_rc_details.length > 0 ? JSON.stringify(s.vehicle_rc_details) : null} />
                {ids.voterId && <DetailField label={t("subject.voter_id")} value={ids.voterId} />}
              </div>
            </div>

            {/* 4. Contact & Address */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.contact_address")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.mobile_numbers")} value={<ArrayChips items={s.mobile_numbers} />} />
                <DetailField label={t("subject.email_addresses")} value={<ArrayChips items={s.email_addresses} />} />
                <DetailField label={t("subject.residential_address")} value={s.residential_address} />
                <DetailField label={t("subject.native_address")} value={s.native_or_permanent_address} />
                <DetailField label={t("subject.native_state")} value={s.native_state} />
              </div>
            </div>

            {/* 5. Financial Intelligence */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.financial_intelligence")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.bank_accounts")} value={
                  typeof s.bank_account_details === "string" && s.bank_account_details === "[REDACTED]"
                    ? <MaskedField label="" value="[REDACTED]" />
                    : Array.isArray(s.bank_account_details) && s.bank_account_details.length > 0
                      ? JSON.stringify(s.bank_account_details)
                      : null
                } />
                <DetailField label={t("subject.transaction_mode")} value={s.transaction_mode} />
                <DetailField label={t("subject.bank_statement_available")} value={<BoolBadge value={s.bank_statement_available} />} />
              </div>
            </div>

            {/* 6. CDR & Links */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.cdr_links")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.cdr_status")} value={
                  <span className={`badge badge--${s.cdr_status === "COMPLETED" ? "success" : s.cdr_status === "NOT_REQUESTED" ? "default" : "info"}`}>{s.cdr_status}</span>
                } />
                <DetailField label={t("subject.cdat_links")} value={<ArrayChips items={s.cdat_links} />} />
                <DetailField label={t("subject.dopams_links")} value={<ArrayChips items={s.dopams_links} />} />
              </div>
            </div>

            {/* 7. Offender Profile */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.offender_profile")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.offender_status")} value={
                  <span className={`badge badge--${s.offender_status === "CONVICTED" ? "critical" : s.offender_status === "ABSCONDING" ? "warning" : "default"}`}>{s.offender_status}</span>
                } />
                <DetailField label={t("subject.offender_role")} value={<ArrayChips items={s.offender_role} />} />
                <DetailField label={t("subject.drug_procurement")} value={s.drug_procurement_method} />
                <DetailField label={t("subject.drug_delivery")} value={s.drug_delivery_method} />
              </div>
            </div>

            {/* 7b. Drug Intelligence Profile */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.drug_intelligence")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.drug_types_dealt")} value={<ArrayChips items={s.drug_types_dealt} />} />
                <DetailField label={t("subject.primary_drug")} value={s.primary_drug} />
                <DetailField label={t("subject.supply_chain_position")} value={s.supply_chain_position} />
                <DetailField label={t("subject.operational_level")} value={s.operational_level} />
                <DetailField label={t("subject.territory_description")} value={s.territory_description} />
                <DetailField label={t("subject.territory_districts")} value={<ArrayChips items={s.territory_districts} />} />
                <DetailField label={t("subject.territory_states")} value={<ArrayChips items={s.territory_states} />} />
                <DetailField label={t("subject.typical_quantity")} value={s.typical_quantity} />
                <DetailField label={t("subject.quantity_category")} value={s.quantity_category} />
                <DetailField label={t("subject.concealment_methods")} value={<ArrayChips items={s.concealment_methods} />} />
                <DetailField label={t("subject.transport_routes")} value={<ArrayChips items={s.transport_routes} />} />
                <DetailField label={t("subject.communication_methods")} value={<ArrayChips items={s.communication_methods} />} />
                <DetailField label={t("subject.known_code_words")} value={<ArrayChips items={s.known_code_words} />} />
              </div>
            </div>

            {/* 8. Legal Flags */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.legal_flags")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.section_of_law")} value={<ArrayChips items={s.section_of_law} />} />
                <DetailField label={t("subject.pd_act")} value={s.pd_act_details} />
                <DetailField label={t("subject.history_sheet")} value={s.history_sheet_details} />
                <DetailField label={t("subject.fit_68f")} value={<BoolBadge value={s.fit_for_68f} />} />
                <DetailField label={t("subject.fit_pitndps")} value={<BoolBadge value={s.fit_for_pitndps_act} />} />
              </div>
            </div>

            {/* 9. Criminal History */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.criminal_history")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.criminal_history")} value={s.criminal_history} />
                <DetailField label={t("subject.ndps_history")} value={s.ndps_history} />
                <DetailField label={t("subject.first_arrested")} value={s.first_arrested_at ? new Date(s.first_arrested_at).toLocaleDateString() : null} />
                <DetailField label={t("subject.total_arrests")} value={s.total_arrests} />
                <DetailField label={t("subject.bail_status")} value={s.bail_status} />
                <DetailField label={t("subject.monitoring_status")} value={s.monitoring_status} />
                <DetailField label={t("subject.modus_operandi")} value={s.modus_operandi} />
                <DetailField label={t("subject.threat_level")} value={s.threat_level ? (
                  <span className={`badge badge--${s.threat_level === "CRITICAL" || s.threat_level === "HIGH" ? "critical" : s.threat_level === "MEDIUM" ? "warning" : "default"}`}>{s.threat_level}</span>
                ) : null} />
              </div>
            </div>

            {/* 9b. Custody & Recidivism */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.custody_recidivism")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.custody_status")} value={s.custody_status ? (
                  <span className={`badge badge--${s.custody_status === "IN_CUSTODY" ? "warning" : s.custody_status === "ABSCONDING" ? "critical" : "default"}`}>{s.custody_status}</span>
                ) : null} />
                <DetailField label={t("subject.jail_name")} value={s.jail_name} />
                <DetailField label={t("subject.total_convictions")} value={s.total_convictions} />
                <DetailField label={t("subject.total_acquittals")} value={s.total_acquittals} />
                <DetailField label={t("subject.last_arrested_at")} value={s.last_arrested_at ? new Date(s.last_arrested_at).toLocaleDateString() : null} />
                <DetailField label={t("subject.is_recidivist")} value={<BoolBadge value={s.is_recidivist} />} />
                <DetailField label={t("subject.is_proclaimed_offender")} value={<BoolBadge value={s.is_proclaimed_offender} />} />
                <DetailField label={t("subject.is_habitual_offender")} value={<BoolBadge value={s.is_habitual_offender} />} />
              </div>
            </div>

            {/* 9c. Biometric & Cross-System IDs */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.cross_system_ids")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.nidaan_id")} value={s.nidaan_id} />
                <DetailField label={t("subject.interpol_notice_ref")} value={s.interpol_notice_ref} />
                <DetailField label={t("subject.ncb_reference")} value={s.ncb_reference} />
                <DetailField label={t("subject.cctns_id")} value={s.cctns_id} />
                {s.fingerprint_nfn && <MaskedField label={t("subject.fingerprint_nfn")} value={s.fingerprint_nfn} />}
                {s.dna_profile_id && <MaskedField label={t("subject.dna_profile_id")} value={s.dna_profile_id} />}
              </div>
            </div>

            {/* 10. Gang Associates */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.gang_associates")}</h2>
              {s.gang_affiliation && (
                <DetailField label={t("subject.gang_affiliation")} value={s.gang_affiliation} />
              )}
              {gangAssociates.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)" }}>{t("subject.no_associates")}</p>
              ) : (
                <div className="detail-grid">
                  {gangAssociates.map((ga, i) => (
                    <div key={ga.subject_id || i} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                      <span className="detail-field__label">{t("subject.associate_name")}</span>
                      <span className="detail-field__value">{ga.full_name}</span>
                      <span className="detail-field__label">{t("subject.relationship_type")}</span>
                      <span className="detail-field__value">{ga.relationship_type || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 11. Social & Digital */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.social_digital")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.social_handles")} value={
                  Array.isArray(s.social_handles) && s.social_handles.length > 0
                    ? s.social_handles.map((h) => `${h.platform}: ${h.handle}`).join(", ")
                    : null
                } />
                <DetailField label={t("subject.whatsapp_refs")} value={<ArrayChips items={s.whatsapp_chat_references} />} />
                <DetailField label={t("subject.social_media_refs")} value={<ArrayChips items={s.social_media_chat_references} />} />
              </div>
            </div>

            {/* 12. Physical Description */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.physical_description")}</h2>
              <div className="detail-grid">
                <DetailField label={t("subject.height")} value={s.height_cm ? `${s.height_cm} cm` : null} />
                <DetailField label={t("subject.weight")} value={s.weight_kg ? `${s.weight_kg} kg` : null} />
                <DetailField label={t("subject.complexion")} value={s.complexion} />
                <DetailField label={t("subject.distinguishing_marks")} value={s.distinguishing_marks} />
                <DetailField label={t("subject.blood_group")} value={s.blood_group} />
                <DetailField label={t("subject.build")} value={s.build} />
                <DetailField label={t("subject.eye_color")} value={s.eye_color} />
                <DetailField label={t("subject.hair_color")} value={s.hair_color} />
                <DetailField label={t("subject.facial_hair")} value={s.facial_hair} />
                <DetailField label={t("subject.handedness")} value={s.handedness} />
                <DetailField label={t("subject.speech_pattern")} value={s.speech_pattern} />
                <DetailField label={t("subject.place_of_birth")} value={s.place_of_birth} />
                <DetailField label={t("subject.full_name_local")} value={s.full_name_local} />
                {Array.isArray(s.scars) && s.scars.length > 0 && (
                  <DetailField label={t("subject.scars")} value={s.scars.map(sc => `${sc.location}: ${sc.description}`).join("; ")} />
                )}
                {Array.isArray(s.tattoos) && s.tattoos.length > 0 && (
                  <DetailField label={t("subject.tattoos")} value={s.tattoos.map(tt => `${tt.location}: ${tt.description}`).join("; ")} />
                )}
                {Array.isArray(s.photo_urls) && s.photo_urls.length > 0 && (
                  <div className="detail-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="detail-field__label">Photos</span>
                    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      {s.photo_urls.map((url, i) => (
                        <img key={i} src={url} alt={`${s.full_name} ${i + 1}`} style={{ maxWidth: "120px", maxHeight: "120px", borderRadius: "var(--radius-md)", objectFit: "cover" }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 13. Family Members */}
            {entities?.family_members && entities.family_members.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.family_members")}</h2>
                <div className="detail-grid">
                  {entities.family_members.map((fm) => (
                    <div key={fm.family_member_id} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                      <span className="detail-field__label">{fm.relationship_type}</span>
                      <span className="detail-field__value">{fm.full_name}</span>
                      {fm.contact_phone && <><span className="detail-field__label">{t("subject.phone")}</span><span className="detail-field__value">{fm.contact_phone}</span></>}
                      {fm.occupation && <><span className="detail-field__label">{t("subject.occupation")}</span><span className="detail-field__value">{fm.occupation}</span></>}
                      {fm.is_involved && <span className="badge badge--critical">{t("subject.involved")}</span>}
                      {fm.is_aware_of_activity && <span className="badge badge--warning">{t("subject.aware")}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 14. FIR Records */}
            {entities?.fir_records && entities.fir_records.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.fir_records")}</h2>
                {entities.fir_records.map((fir) => (
                  <div key={fir.fir_record_id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div className="detail-grid">
                      <DetailField label={t("subject.fir_number")} value={fir.fir_number} />
                      <DetailField label={t("subject.fir_date")} value={fir.fir_date ? new Date(fir.fir_date).toLocaleDateString() : null} />
                      <DetailField label={t("subject.police_station")} value={fir.police_station} />
                      <DetailField label={t("subject.district")} value={fir.district} />
                      <DetailField label={t("subject.sections_of_law")} value={<ArrayChips items={fir.sections_of_law} />} />
                      <DetailField label={t("subject.role_in_case")} value={fir.role_in_case} />
                      <DetailField label={t("subject.arrest_date")} value={fir.arrest_date ? new Date(fir.arrest_date).toLocaleDateString() : null} />
                      <DetailField label={t("subject.case_stage")} value={fir.case_stage} />
                      <DetailField label={t("subject.court_name")} value={fir.court_name} />
                      <DetailField label={t("subject.verdict")} value={fir.verdict} />
                      {fir.bail_type && <DetailField label={t("subject.bail_type")} value={fir.bail_type} />}
                      {fir.next_hearing_date && <DetailField label={t("subject.next_hearing")} value={new Date(fir.next_hearing_date).toLocaleDateString()} />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 15. Seizure Records */}
            {entities?.seizure_records && entities.seizure_records.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.seizure_records")}</h2>
                {entities.seizure_records.map((sz) => (
                  <div key={sz.seizure_id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div className="detail-grid">
                      <DetailField label={t("subject.drug_type")} value={sz.drug_type} />
                      <DetailField label={t("subject.seizure_date")} value={sz.seizure_date ? new Date(sz.seizure_date).toLocaleDateString() : null} />
                      <DetailField label={t("subject.seizure_location")} value={sz.seizure_location} />
                      <DetailField label={t("subject.gross_weight")} value={sz.gross_weight_grams ? `${sz.gross_weight_grams}g` : null} />
                      <DetailField label={t("subject.net_weight")} value={sz.net_weight_grams ? `${sz.net_weight_grams}g` : null} />
                      <DetailField label={t("subject.purity")} value={sz.purity_percentage ? `${sz.purity_percentage}%` : null} />
                      <DetailField label={t("subject.street_value")} value={sz.estimated_street_value ? `₹${sz.estimated_street_value.toLocaleString()}` : null} />
                      <DetailField label={t("subject.quantity_category")} value={sz.quantity_category} />
                      <DetailField label={t("subject.field_test")} value={sz.field_test_result} />
                      <DetailField label={t("subject.fsl_result")} value={sz.fsl_report_result} />
                      <DetailField label={t("subject.disposal_status")} value={sz.disposal_status} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 16. Warrant Records */}
            {entities?.warrant_records && entities.warrant_records.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.warrant_records")}</h2>
                {entities.warrant_records.map((w) => (
                  <div key={w.warrant_id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div className="detail-grid">
                      <DetailField label={t("subject.warrant_type")} value={w.warrant_type} />
                      <DetailField label={t("subject.warrant_number")} value={w.warrant_number} />
                      <DetailField label={t("subject.warrant_date")} value={w.warrant_date ? new Date(w.warrant_date).toLocaleDateString() : null} />
                      <DetailField label={t("subject.issuing_court")} value={w.issuing_court} />
                      <DetailField label={t("subject.warrant_status")} value={
                        <span className={`badge badge--${w.is_executed ? "success" : "warning"}`}>{w.status}</span>
                      } />
                      {w.pitndps_order_number && <DetailField label={t("subject.pitndps_order")} value={w.pitndps_order_number} />}
                      {w.detention_period_days && <DetailField label={t("subject.detention_period")} value={`${w.detention_period_days} days`} />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 17. Property & Assets */}
            {entities?.property_assets && entities.property_assets.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.property_assets")}</h2>
                <div className="detail-grid">
                  {entities.property_assets.map((pa) => (
                    <div key={pa.property_id} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                      <span className="detail-field__label">{pa.property_type}</span>
                      <span className="detail-field__value">{pa.description || "—"}</span>
                      {pa.location && <><span className="detail-field__label">{t("subject.location")}</span><span className="detail-field__value">{pa.location}</span></>}
                      {pa.estimated_value && <><span className="detail-field__label">{t("subject.value")}</span><span className="detail-field__value">₹{pa.estimated_value.toLocaleString()}</span></>}
                      {pa.is_attached && <span className="badge badge--warning">{t("subject.attached")}</span>}
                      {pa.is_confiscated && <span className="badge badge--critical">{t("subject.confiscated")}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 18. Phones (Enriched) */}
            {entities?.phones && entities.phones.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.phones_detailed")}</h2>
                <div className="detail-grid">
                  {entities.phones.map((ph) => (
                    <div key={ph.phone_id} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                      <span className="detail-field__label">{ph.phone_type || t("subject.phone")}</span>
                      <span className="detail-field__value">{ph.normalized_value || ph.raw_value}</span>
                      {ph.registered_name && <><span className="detail-field__label">{t("subject.registered_name")}</span><span className="detail-field__value">{ph.registered_name}</span></>}
                      {ph.imei && <><span className="detail-field__label">IMEI</span><span className="detail-field__value">{ph.imei}</span></>}
                      {ph.messaging_apps && ph.messaging_apps.length > 0 && <><span className="detail-field__label">{t("subject.messaging_apps")}</span><span className="detail-field__value"><ArrayChips items={ph.messaging_apps} /></span></>}
                      <span className={`badge badge--${ph.is_active ? "success" : "default"}`}>{ph.is_active ? t("subject.active") : t("subject.inactive")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 19. Addresses (Enriched) */}
            {entities?.addresses && entities.addresses.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.addresses_detailed")}</h2>
                <div className="detail-grid">
                  {entities.addresses.map((addr) => (
                    <div key={addr.address_id} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                      <span className="detail-field__label">{addr.address_type}</span>
                      <span className="detail-field__value">{addr.full_address}</span>
                      {addr.village_town && <><span className="detail-field__label">{t("subject.village_town")}</span><span className="detail-field__value">{addr.village_town}</span></>}
                      {addr.tehsil && <><span className="detail-field__label">{t("subject.tehsil")}</span><span className="detail-field__value">{addr.tehsil}</span></>}
                      {addr.district && <><span className="detail-field__label">{t("subject.district")}</span><span className="detail-field__value">{addr.district}</span></>}
                      {addr.pin_code && <><span className="detail-field__label">{t("subject.pin_code")}</span><span className="detail-field__value">{addr.pin_code}</span></>}
                      {addr.verified_at && <span className="badge badge--success">{t("subject.verified")}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 20. Vehicles */}
            {entities?.vehicles && entities.vehicles.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.vehicles")}</h2>
                {entities.vehicles.map((v) => (
                  <div key={v.vehicle_id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div className="detail-grid">
                      <DetailField label={t("subject.registration_number")} value={v.registration_number} />
                      <DetailField label={t("subject.vehicle_type")} value={v.vehicle_type} />
                      <DetailField label={t("subject.make_model")} value={[v.make, v.model].filter(Boolean).join(" ") || null} />
                      <DetailField label={t("subject.color")} value={v.color} />
                      <DetailField label={t("subject.engine_number")} value={v.engine_number} />
                      <DetailField label={t("subject.chassis_number")} value={v.chassis_number} />
                      <DetailField label={t("subject.registered_owner")} value={v.registered_owner_name} />
                      {v.is_stolen && <span className="badge badge--critical">{t("subject.stolen")}</span>}
                      {v.is_under_surveillance && <span className="badge badge--warning">{t("subject.under_surveillance")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 21. Devices */}
            {entities?.devices && entities.devices.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.devices")}</h2>
                <div className="detail-grid">
                  {entities.devices.map((d) => (
                    <div key={d.device_id} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                      <span className="detail-field__label">{d.device_type || t("subject.device")}</span>
                      <span className="detail-field__value">{[d.brand, d.model].filter(Boolean).join(" ") || "—"}</span>
                      {d.imei_1 && <><span className="detail-field__label">IMEI</span><span className="detail-field__value">{d.imei_1}</span></>}
                      {d.forensic_extraction_status && <><span className="detail-field__label">{t("subject.extraction_status")}</span><span className="detail-field__value">{d.forensic_extraction_status}</span></>}
                      {d.is_encrypted && <span className="badge badge--warning">{t("subject.encrypted")}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 22. Bank Accounts (Enriched) */}
            {entities?.bank_accounts && entities.bank_accounts.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.bank_accounts_detailed")}</h2>
                {entities.bank_accounts.map((ba) => (
                  <div key={ba.bank_account_id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div className="detail-grid">
                      <DetailField label={t("subject.bank_name")} value={ba.bank_name} />
                      <MaskedField label={t("subject.account_number")} value={ba.account_number} />
                      <DetailField label={t("subject.ifsc")} value={ba.ifsc_code} />
                      <DetailField label={t("subject.branch")} value={ba.branch_name} />
                      <DetailField label={t("subject.account_type")} value={ba.account_type} />
                      <DetailField label={t("subject.account_holder")} value={ba.account_holder_name} />
                      {ba.is_frozen && <span className="badge badge--critical">{t("subject.frozen")}</span>}
                      {ba.suspicious_transaction_count > 0 && (
                        <DetailField label={t("subject.suspicious_txns")} value={
                          <span className="badge badge--critical">{ba.suspicious_transaction_count}</span>
                        } />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 23. UPI / Crypto / Hawala */}
            {((entities?.upi_accounts && entities.upi_accounts.length > 0) ||
              (entities?.crypto_wallets && entities.crypto_wallets.length > 0) ||
              (entities?.hawala_contacts && entities.hawala_contacts.length > 0)) && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.alternate_financial")}</h2>
                {entities?.upi_accounts && entities.upi_accounts.length > 0 && (
                  <>
                    <h3 style={{ fontSize: "0.875rem", margin: "var(--space-2) 0" }}>{t("subject.upi_accounts")}</h3>
                    <div className="detail-grid">
                      {entities.upi_accounts.map((u) => (
                        <div key={u.upi_account_id} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                          <span className="detail-field__label">VPA</span>
                          <span className="detail-field__value">{u.vpa}</span>
                          {u.provider_app && <><span className="detail-field__label">{t("subject.provider")}</span><span className="detail-field__value">{u.provider_app}</span></>}
                          <span className={`badge badge--${u.is_active ? "success" : "default"}`}>{u.is_active ? t("subject.active") : t("subject.inactive")}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {entities?.crypto_wallets && entities.crypto_wallets.length > 0 && (
                  <>
                    <h3 style={{ fontSize: "0.875rem", margin: "var(--space-2) 0" }}>{t("subject.crypto_wallets")}</h3>
                    <div className="detail-grid">
                      {entities.crypto_wallets.map((cw) => (
                        <div key={cw.crypto_wallet_id} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                          <span className="detail-field__label">{cw.currency || "Crypto"}</span>
                          <span className="detail-field__value" style={{ wordBreak: "break-all" }}>{cw.wallet_address}</span>
                          {cw.exchange_name && <><span className="detail-field__label">{t("subject.exchange")}</span><span className="detail-field__value">{cw.exchange_name}</span></>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {entities?.hawala_contacts && entities.hawala_contacts.length > 0 && (
                  <>
                    <h3 style={{ fontSize: "0.875rem", margin: "var(--space-2) 0" }}>{t("subject.hawala_contacts")}</h3>
                    <div className="detail-grid">
                      {entities.hawala_contacts.map((h) => (
                        <div key={h.hawala_contact_id} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                          <span className="detail-field__label">{h.contact_name}</span>
                          <span className="detail-field__value">{h.contact_location || "—"}</span>
                          {h.hawala_route && <><span className="detail-field__label">{t("subject.route")}</span><span className="detail-field__value">{h.hawala_route}</span></>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 24. Location Sightings */}
            {entities?.location_sightings && entities.location_sightings.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.location_sightings")}</h2>
                {entities.location_sightings.map((ls) => (
                  <div key={ls.sighting_id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div className="detail-grid">
                      <DetailField label={t("subject.sighting_type")} value={ls.sighting_type} />
                      <DetailField label={t("subject.location")} value={ls.location_description} />
                      <DetailField label={t("subject.observed_at")} value={ls.observed_at ? new Date(ls.observed_at).toLocaleString() : null} />
                      {ls.latitude && ls.longitude && (
                        <DetailField label={t("subject.coordinates")} value={`${ls.latitude}, ${ls.longitude}`} />
                      )}
                      <DetailField label={t("subject.confidence_score")} value={ls.confidence ? `${(ls.confidence * 100).toFixed(0)}%` : null} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 25. Social Accounts (Enriched) */}
            {entities?.social_accounts && entities.social_accounts.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.social_accounts_detailed")}</h2>
                <div className="detail-grid">
                  {entities.social_accounts.map((sa) => (
                    <div key={sa.account_id} className="detail-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                      <span className="detail-field__label">{sa.platform}</span>
                      <span className="detail-field__value">{sa.handle}</span>
                      {sa.display_name && <><span className="detail-field__label">{t("subject.display_name")}</span><span className="detail-field__value">{sa.display_name}</span></>}
                      {sa.follower_count !== null && <><span className="detail-field__label">{t("subject.followers")}</span><span className="detail-field__value">{sa.follower_count?.toLocaleString()}</span></>}
                      {sa.flagged_content_count > 0 && <span className="badge badge--critical">{sa.flagged_content_count} {t("subject.flagged")}</span>}
                      {sa.is_verified && <span className="badge badge--success">{t("subject.verified")}</span>}
                      {sa.is_private && <span className="badge badge--default">{t("subject.private")}</span>}
                      <span className={`badge badge--${sa.activity_status === "ACTIVE" ? "success" : "default"}`}>{sa.activity_status || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extraction Confidence & Source Docs */}
            {(s.extraction_confidence_score !== null || (s.source_document_references && s.source_document_references.length > 0)) && (
              <div className="detail-section">
                <div className="detail-grid">
                  <DetailField label={t("subject.confidence_score")} value={s.extraction_confidence_score !== null ? `${(s.extraction_confidence_score * 100).toFixed(1)}%` : null} />
                  <DetailField label={t("subject.source_docs")} value={<ArrayChips items={s.source_document_references} />} />
                </div>
              </div>
            )}
          </>
        )},
        { key: "notes", label: t("detail.tab_notes"), content: (
          <div className="detail-section">
            <div style={{ marginBottom: "var(--space-4)" }}>
              <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={t("notes.placeholder")} disabled={isOffline} />
              <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim() || submittingNote || isOffline} style={{ marginTop: "var(--space-2)" }}>
                {t("notes.add")}
              </Button>
            </div>
            {notes.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>{t("notes.empty")}</p> : (
              <ul className="notes-list">
                {notes.map((n) => (
                  <li key={n.note_id} className="notes-list__item">
                    <p>{n.note_text}</p>
                    <small style={{ color: "var(--color-text-muted)" }}>{n.created_by} — {new Date(n.created_at).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )},
        { key: "activity", label: t("detail.tab_activity"), content: (
          <div className="detail-section">
            {activity.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>{t("activity.empty")}</p> : (
              <ul className="activity-list">
                {activity.map((e) => (
                  <li key={e.event_id} className="activity-list__item">
                    <span className="activity-list__type">{e.event_type}</span>
                    <small style={{ color: "var(--color-text-muted)" }}>{e.actor_id} — {new Date(e.created_at).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )},
        { key: "crime_history", label: t("detail.tab_crime_history"), content: (
          <div className="detail-section">
            <CrimeTimeline subject={s} entities={entities} t={t} />
          </div>
        )},
        { key: "network", label: t("detail.tab_network"), content: (
          <Suspense fallback={<SkeletonBlock height="20rem" />}>
            <SubjectNetwork
              subjectId={id}
              subjectName={subject?.full_name}
              authHeaders={authHeaders}
              isOffline={isOffline}
              onNavigate={onNavigate}
              embedded
            />
          </Suspense>
        )},
      ]} />

      {availableTransitions.length > 0 && (
        <div className="transition-bar">
          <h2 className="detail-section__title">{t("transition.title")}</h2>
          <Field label={t("transition.select_action")} htmlFor="transition-select">
            <Select id="transition-select" value={selectedTransition} onChange={(e) => setSelectedTransition(e.target.value)} disabled={isOffline}>
              <option value="">{t("transition.select_placeholder")}</option>
              {availableTransitions.map((tr) => (
                <option key={tr.transitionId} value={tr.transitionId}>{tr.label} → {tr.toStateId}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("transition.remarks")} htmlFor="transition-remarks">
            <Input id="transition-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={t("transition.remarks_placeholder")} disabled={isOffline} />
          </Field>
          <div className="transition-bar__actions">
            <Button onClick={handleTransition} disabled={!selectedTransition || transitioning || isOffline}>
              {t(transitioning ? "transition.submitting" : "transition.submit")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
