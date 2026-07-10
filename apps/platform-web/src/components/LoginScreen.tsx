import { useEffect, useState, type FormEvent } from "react";
import { fetchAuthConfig, platformLogin, type PlatformSessionUser } from "../platform-api";
import { GovBanner, OfficialsRow, StateEmblem } from "./GovBranding";

const ERROR_MESSAGES: Record<string, string> = {
  LOGIN_FAILED: "Invalid username, password, or authenticator code.",
  LOGIN_LOCKED: "Too many failed attempts. Try again in a few minutes.",
  LOGIN_FIELDS_REQUIRED: "Enter your username, password, and authenticator code.",
};

const MODULES = [
  "DOPAMS",
  "IQW Complaints",
  "Forensic Lab",
  "Social Media Intelligence",
  "Knowledge Base",
];

export function LoginScreen({
  onSignedIn,
}: {
  onSignedIn: (user: PlatformSessionUser) => void;
}): JSX.Element {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordOnly, setPasswordOnly] = useState(false);

  useEffect(() => {
    fetchAuthConfig()
      .then((config) => setPasswordOnly(config.password_only_login))
      .catch(() => setPasswordOnly(false));
  }, []);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await platformLogin({ username, password, totp });
      onSignedIn(user);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "LOGIN_FAILED";
      setError(ERROR_MESSAGES[code] ?? "Sign-in failed. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="gov-login-page">
      <GovBanner />

      <div className="gov-login-body">
        <section className="gov-login-brand" aria-label="About this platform">
          <div className="gov-login-brand-head">
            <h1>Integrated Policing Platform</h1>
            <p className="gov-login-title-ml" lang="ml">
              സംയോജിത പോലീസിംഗ് പ്ലാറ്റ്ഫോം
            </p>
            <p className="gov-login-tagline">
              One secure sign-in for the state&rsquo;s investigation, intelligence, and monitoring
              systems — with every access decision recorded in the authorization ledger.
            </p>
          </div>

          <ul className="gov-login-modules" aria-label="Integrated applications">
            {MODULES.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>

          <OfficialsRow />
        </section>

        <div className="gov-login-card-col">
          <form className="gov-login-card" onSubmit={handleSubmit} aria-label="Platform sign in">
            <div className="gov-login-card-head">
              <StateEmblem size={56} />
              <h2>Sign in</h2>
              <p>Authorised Kerala Police personnel only</p>
            </div>

            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {passwordOnly ? null : (
              <>
                <label htmlFor="login-totp">Authenticator code</label>
                <input
                  id="login-totp"
                  name="totp"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={totp}
                  onChange={(event) => setTotp(event.target.value)}
                  required
                />
              </>
            )}
            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={submitting}>
              {submitting ? <span className="gov-login-spinner" aria-hidden="true" /> : null}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
            <p className="gov-login-restricted">
              Restricted system — all access is logged and audited. Unauthorised access is an
              offence under the Information Technology Act, 2000.
            </p>
            {import.meta.env.DEV ? (
              <div className="test-credentials">
                <p className="test-credentials__title">
                  Test credentials — password: <code>password123</code>, code: <code>000000</code>
                </p>
                <p>admin — Platform Admin (DOPAMS · IQW · Knowledge)</p>
                <p>forensic.analyst — opens Forensic Lab</p>
                <p>intel.analyst — opens Social Media Intelligence</p>
                <p>dopams.operator — opens DOPAMS · IQW</p>
                <p className="test-credentials__note">
                  Each persona is scoped to its own apps (real entitlement check).
                </p>
              </div>
            ) : null}
            <p className="gov-login-help">
              Trouble signing in? Contact the State Police IT Cell, Police Headquarters,
              Thiruvananthapuram.
            </p>
          </form>
        </div>
      </div>

      <footer className="gov-login-footer">
        <span>© Government of Kerala · Kerala Police</span>
        <span>Content owned by the Home Department, Government of Kerala.</span>
      </footer>
    </main>
  );
}
