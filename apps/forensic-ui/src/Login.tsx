import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, PasswordInput } from "@puda/shared";
import { useTheme } from "./theme";
import type { ThemePreference } from "./theme";

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

export default function Login({ onLogin }: LoginProps) {
  const { theme, setTheme } = useTheme("forensic_theme");
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <a href="#forensic-login-main" className="skip-link">{t("common.skip_to_main")}</a>
      <header className="page__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div>
          <p className="eyebrow">{t("app.brand")}</p>
          <h1>{t("login.title")}</h1>
        </div>
        <select className="login-theme-select" value={theme} onChange={(e) => setTheme(e.target.value as ThemePreference)} aria-label="Theme">
          <option value="light">{t("settings.theme_light")}</option>
          <option value="dark">{t("settings.theme_dark")}</option>
          <option value="system">{t("settings.theme_system")}</option>
        </select>
      </header>
      <main id="forensic-login-main" className="panel login-panel" role="main">
        <form onSubmit={handleSubmit} className="login-form">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Field label={t("login.username")} htmlFor="forensic-login-username" required>
            <Input id="forensic-login-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder={t("login.username_placeholder")} autoComplete="username" />
          </Field>
          <Field label={t("login.password")} htmlFor="forensic-login-password" required>
            <PasswordInput id="forensic-login-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={t("login.password_placeholder")} autoComplete="current-password" />
          </Field>
          <Button type="submit" disabled={loading} fullWidth>
            {t(loading ? "login.loading" : "login.submit")}
          </Button>
          {import.meta.env.DEV && (
            <div className="test-credentials">
              <p className="test-credentials__title">{t("login.test_credentials")}</p>
              <p>{t("login.test_admin")}</p>
              <p>{t("login.test_examiner")}</p>
              <p>{t("login.test_reviewer")}</p>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
