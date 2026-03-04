import { useTranslation } from "react-i18next";
import { Field, Select } from "@puda/shared";
import { useTheme, CUSTOM_THEMES } from "../theme";
import type { ThemePreference } from "../theme";

export default function Settings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme("dopams_theme");

  return (
    <>
      <div className="page__header">
        <h1>{t("settings.title")}</h1>
        <p className="subtitle">{t("settings.subtitle")}</p>
      </div>

      <div className="detail-section">
        <h2 className="detail-section__title">{t("settings.appearance")}</h2>
        <div className="detail-grid">
          <Field label={t("settings.theme")} htmlFor="pref-theme">
            <Select
              id="pref-theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemePreference)}
            >
              <option value="light">{t("settings.theme_light")}</option>
              <option value="dark">{t("settings.theme_dark")}</option>
              <option value="system">{t("settings.theme_system")}</option>
              {CUSTOM_THEMES.map((ct) => (
                <option key={ct} value={ct}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </>
  );
}
