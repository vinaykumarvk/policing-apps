import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { apiBaseUrl } from "../types";

export type FilterState = {
  dateFrom: string;
  dateTo: string;
  district: string;
  platforms: string[];
  priority: string;
  category: string;
  granularity: "daily" | "weekly" | "monthly";
};

type Props = {
  value: FilterState;
  onChange: (f: FilterState) => void;
  authHeaders: () => Record<string, string>;
};

const DATE_PRESETS: { key: string; days: number }[] = [
  { key: "dashboard.preset_today", days: 0 },
  { key: "dashboard.preset_7d", days: 7 },
  { key: "dashboard.preset_30d", days: 30 },
  { key: "dashboard.preset_90d", days: 90 },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function defaultFilters(): FilterState {
  return {
    dateFrom: daysAgo(30),
    dateTo: new Date().toISOString().slice(0, 10),
    district: "",
    platforms: [],
    priority: "",
    category: "",
    granularity: "daily",
  };
}

/** Compact granularity + date-preset bar — rendered inline above trend chart */
export function GranularityBar({ value, onChange }: { value: FilterState; onChange: (f: FilterState) => void }) {
  const { t } = useTranslation();
  const set = useCallback(
    (patch: Partial<FilterState>) => onChange({ ...value, ...patch }),
    [value, onChange],
  );
  return (
    <div className="filter-bar filter-bar--inline">
      <div className="filter-bar__presets">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`filter-chip ${value.dateFrom === daysAgo(p.days) ? "filter-chip--active" : ""}`}
            onClick={() => set({ dateFrom: daysAgo(p.days), dateTo: new Date().toISOString().slice(0, 10) })}
          >
            {t(p.key)}
          </button>
        ))}
      </div>
      <div className="filter-bar__chips">
        {(["daily", "weekly", "monthly"] as const).map((g) => (
          <button
            key={g}
            type="button"
            className={`filter-chip ${value.granularity === g ? "filter-chip--active" : ""}`}
            onClick={() => set({ granularity: g })}
          >
            {t(`dashboard.granularity_${g}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DashboardFilters({ value, onChange, authHeaders }: Props) {
  const { t } = useTranslation();
  const [districts, setDistricts] = useState<{ unit_id: string; name: string }[]>([]);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/config/units`, authHeaders())
      .then((r) => (r.ok ? r.json() : { units: [] }))
      .then((d) => setDistricts(d.units || []))
      .catch(() => {});
  }, [authHeaders]);

  const set = useCallback(
    (patch: Partial<FilterState>) => onChange({ ...value, ...patch }),
    [value, onChange],
  );

  return (
    <div className="filter-bar">
      {/* Date range inputs */}
      <div className="ui-field">
        <label className="ui-field__label">{t("dashboard.filter_from")}</label>
        <input
          type="date"
          className="ui-field__input"
          value={value.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
        />
      </div>
      <div className="ui-field">
        <label className="ui-field__label">{t("dashboard.filter_to")}</label>
        <input
          type="date"
          className="ui-field__input"
          value={value.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
        />
      </div>

      {/* District */}
      <div className="ui-field">
        <label className="ui-field__label">{t("dashboard.filter_district")}</label>
        <select
          className="ui-field__input"
          value={value.district}
          onChange={(e) => set({ district: e.target.value })}
        >
          <option value="">{t("filter.all")}</option>
          {districts.map((d) => (
            <option key={d.unit_id} value={d.unit_id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div className="ui-field">
        <label className="ui-field__label">{t("dashboard.filter_priority")}</label>
        <select
          className="ui-field__input"
          value={value.priority}
          onChange={(e) => set({ priority: e.target.value })}
        >
          <option value="">{t("filter.all")}</option>
          <option value="CRITICAL">{t("dashboard.priority_critical")}</option>
          <option value="HIGH">{t("dashboard.priority_high")}</option>
          <option value="MEDIUM">{t("dashboard.priority_medium")}</option>
          <option value="LOW">{t("dashboard.priority_low")}</option>
        </select>
      </div>
    </div>
  );
}
