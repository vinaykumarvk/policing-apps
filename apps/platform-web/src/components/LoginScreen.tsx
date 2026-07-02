import { useState, type FormEvent } from "react";
import { platformLogin, type PlatformSessionUser } from "../platform-api";

const ERROR_MESSAGES: Record<string, string> = {
  LOGIN_FAILED: "Invalid username, password, or authenticator code.",
  LOGIN_LOCKED: "Too many failed attempts. Try again in a few minutes.",
  LOGIN_FIELDS_REQUIRED: "Enter your username, password, and authenticator code.",
};

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
    <main className="status-page">
      <form className="status-panel login-panel" onSubmit={handleSubmit} aria-label="Platform sign in">
        <p className="eyebrow">Punjab Police</p>
        <h2>Sign in to the Policing Platform</h2>
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
        {error ? (
          <p className="login-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
