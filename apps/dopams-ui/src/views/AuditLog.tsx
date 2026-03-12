import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, Select } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

type AuditEntry = {
  audit_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  details?: string;
};

const PAGE_SIZE = 25;

export default function AuditLog({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actor, setActor] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");

  const fetchEntries = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (actor) params.set("actor", actor);
    if (entityType) params.set("entity_type", entityType);
    if (entityId) params.set("entity_id", entityId);

    fetch(`${apiBaseUrl}/api/v1/admin/audit-log?${params}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        const rows = data.entries || data.rows || [];
        setEntries(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("common.error")))
      .finally(() => setLoading(false));
  }, [page, dateFrom, dateTo, actor, entityType, entityId, authHeaders, t]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleFilter = () => { setPage(0); fetchEntries(); };

  return (
    <div className="panel">
      <h1>{t("audit.title")}</h1>

      <div className="filter-bar">
        <Field label={t("audit.date_from")} htmlFor="audit-from">
          <Input id="audit-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </Field>
        <Field label={t("audit.date_to")} htmlFor="audit-to">
          <Input id="audit-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </Field>
        <Field label={t("audit.actor")} htmlFor="audit-actor">
          <Input id="audit-actor" value={actor} onChange={(e) => setActor(e.target.value)} placeholder={t("audit.actor_placeholder")} />
        </Field>
        <Field label={t("audit.entity_type")} htmlFor="audit-etype">
          <Select id="audit-etype" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">{t("audit.all_types")}</option>
            <option value="case">Case</option>
            <option value="alert">Alert</option>
            <option value="task">Task</option>
            <option value="user">User</option>
          </Select>
        </Field>
        <Field label={t("audit.entity_id")} htmlFor="audit-eid">
          <Input id="audit-eid" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder={t("audit.entity_id_placeholder")} />
        </Field>
        <div className="filter-bar__actions">
          <Button onClick={handleFilter} disabled={isOffline}>{t("audit.apply_filters")}</Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p>{t("common.loading")}</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>{t("audit.no_entries")}</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>{t("audit.col_timestamp")}</th>
                  <th>{t("audit.col_actor")}</th>
                  <th>{t("audit.col_action")}</th>
                  <th>{t("audit.col_entity_type")}</th>
                  <th>{t("audit.col_entity_id")}</th>
                  <th>{t("audit.col_details")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.audit_id}>
                    <td data-label={t("audit.col_timestamp")}>{new Date(e.created_at).toLocaleString()}</td>
                    <td data-label={t("audit.col_actor")}>{e.actor_id}</td>
                    <td data-label={t("audit.col_action")}>{e.action}</td>
                    <td data-label={t("audit.col_entity_type")}>{e.entity_type}</td>
                    <td data-label={t("audit.col_entity_id")} style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{e.entity_id}</td>
                    <td data-label={t("audit.col_details")}>{e.details || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-4)" }}>
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              {t("audit.prev_page")}
            </Button>
            <span style={{ color: "var(--color-text-muted)" }}>{t("audit.page_label", { page: page + 1 })}</span>
            <Button size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
              {t("audit.next_page")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
