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
  showGranularity?: boolean;
};

const DATE_PRESETS: { key: string; days: number }[] = [
  { key: "dashboard.preset_today", days: 0 },
  { key: "dashboard.preset_7d", days: 7 },
  { key: "dashboard.preset_30d", days: 30 },
  { key: "dashboard.preset_90d", days: 90 },
];

const PLATFORMS = ["Twitter", "Facebook", "Instagram", "Telegram", "YouTube", "WhatsApp"];

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

export default function DashboardFilters({ value, onChange, authHeaders, showGranularity = false }: Props) {
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

  const togglePlatform = (p: string) => {
    const next = value.platforms.includes(p)
      ? value.platforms.filter((x) => x !== p)
      : [...value.platforms, p];
    set({ platforms: next });
  };

  return (
    <div className="filter-bar">
      {/* Date presets */}
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

      {/* Platform chips */}
      <div className="ui-field">
        <label className="ui-field__label">{t("dashboard.filter_platform")}</label>
        <div className="filter-bar__chips">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              className={`filter-chip ${value.platforms.includes(p) ? "filter-chip--active" : ""}`}
              onClick={() => togglePlatform(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Granularity toggle */}
      {showGranularity && (
        <div className="ui-field">
          <label className="ui-field__label">{t("dashboard.granularity")}</label>
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
      )}
    </div>
  );
}
