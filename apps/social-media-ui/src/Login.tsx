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
  const { theme, setTheme } = useTheme("sm_theme");
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("sm_remember") === "true");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      localStorage.setItem("sm_remember", String(rememberMe));
      if (rememberMe) {
        localStorage.setItem("sm_saved_username", username);
      } else {
        localStorage.removeItem("sm_saved_username");
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
      const saved = localStorage.getItem("sm_saved_username");
      if (saved) setUsername(saved);
    }
  });

  return (
    <div className="login-page">
      <a href="#sm-login-form" className="skip-link">
        {t("common.skip_to_main")}
      </a>
      <div className="login-container">
        <header className="login-header">
          <div className="login-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
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

        <main id="sm-login-form" role="main">
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
                  <Field label={t("login.email_or_username")} htmlFor="sm-forgot-email" required>
                    <Input
                      id="sm-forgot-email"
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
              <Field label={t("login.username")} htmlFor="sm-login-username" required>
                <Input
                  id="sm-login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder={t("login.username_placeholder")}
                  autoComplete="username"
                />
              </Field>
              <Field label={t("login.password")} htmlFor="sm-login-password" required>
                <PasswordInput
                  id="sm-login-password"
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
                  <p>{t("login.test_analyst")}</p>
                  <p>{t("login.test_monitor")}</p>
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
