import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, PasswordInput } from "@puda/shared";
import { useTheme } from "./theme";
import { CUSTOM_THEMES } from "./theme";
import type { ThemePreference } from "./theme";
import "./login.css";

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

const THEME_LABELS: Record<string, string> = {
  light: "Light", dark: "Dark", system: "System",
  rolex: "Rolex", nord: "Nord", dracula: "Dracula",
  solarized: "Solarized", monokai: "Monokai", catppuccin: "Catppuccin",
  gruvbox: "Gruvbox", onedark: "One Dark", tokyonight: "Tokyo Night",
  rosepine: "Rose Pine", ayu: "Ayu", github: "GitHub Dark", sunset: "Sunset",
};

export default function Login({ onLogin }: LoginProps) {
  const { theme, setTheme } = useTheme("forensic_theme");
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("forensic_remember") === "true");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      localStorage.setItem("forensic_remember", String(rememberMe));
      if (rememberMe) {
        localStorage.setItem("forensic_saved_username", username);
      } else {
        localStorage.removeItem("forensic_saved_username");
      }
      window.location.hash = "";
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSent(true);
  };

  useState(() => {
    if (rememberMe) {
      const saved = localStorage.getItem("forensic_saved_username");
      if (saved) setUsername(saved);
    }
  });

  return (
    <div className="login-page">
      <a href="#forensic-login-form" className="skip-link">
        {t("common.skip_to_main")}
      </a>
      <div className="login-container">
        <header className="login-header">
          <div className="login-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="11" y1="8" x2="11" y2="14" />
            </svg>
          </div>
          <h1>{t("app.brand")}</h1>
          <p className="login-subtitle">{t("app.subtitle")}</p>
          <div className="login-header-controls">
            <select
              className="login-control-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemePreference)}
              aria-label={t("settings.theme")}
            >
              <optgroup label={t("settings.appearance")}>
                {["light", "dark", "system", ...CUSTOM_THEMES].map((k) => (
                  <option key={k} value={k}>{THEME_LABELS[k] || k}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </header>

        <main id="forensic-login-form" role="main">
          {showForgot ? (
            <div className="forgot-panel">
              <button type="button" className="forgot-panel__back" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}>
                &larr; {t("login.back_to_login")}
              </button>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t("login.forgot_password")}</h2>
              {forgotSent ? (
                <Alert variant="success">{t("login.reset_link_sent")}</Alert>
              ) : (
                <form onSubmit={handleForgotSubmit} className="login-form">
                  <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", margin: 0 }}>
                    {t("login.forgot_instructions")}
                  </p>
                  <Field label={t("login.email_or_username")} htmlFor="forensic-forgot-email" required>
                    <Input
                      id="forensic-forgot-email"
                      type="text"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      placeholder={t("login.email_or_username_placeholder")}
                      autoComplete="username"
                    />
                  </Field>
                  <Button type="submit" fullWidth>
                    {t("login.send_reset_link")}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              {error ? <Alert variant="error">{error}</Alert> : null}
              <Field label={t("login.username")} htmlFor="forensic-login-username" required>
                <Input
                  id="forensic-login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder={t("login.username_placeholder")}
                  autoComplete="username"
                />
              </Field>
              <Field label={t("login.password")} htmlFor="forensic-login-password" required>
                <PasswordInput
                  id="forensic-login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t("login.password_placeholder")}
                  autoComplete="current-password"
                />
              </Field>
              <div className="login-form-options">
                <label className="login-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  {t("login.remember_me")}
                </label>
                <button type="button" className="login-forgot" onClick={() => setShowForgot(true)}>
                  {t("login.forgot_password")}
                </button>
              </div>
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
          )}
        </main>

        <footer className="login-footer">
          {t("login.footer_text")}
        </footer>
      </div>
    </div>
  );
}
