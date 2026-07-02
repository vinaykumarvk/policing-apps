import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createPlatformUser,
  listPlatformUsers,
  listRoleTemplates,
  resetPlatformUserPassword,
  resetPlatformUserTotp,
  setPlatformUserStatus,
  type CreatedUserSecrets,
  type PlatformUserSummary,
  type RoleTemplateSummary,
} from "../platform-api";

const ERROR_MESSAGES: Record<string, string> = {
  USERNAME_TAKEN: "That username already exists.",
  USERNAME_INVALID: "Usernames are 3-64 chars: lowercase letters, digits, dots, dashes.",
  PASSWORD_TOO_SHORT: "Password must be at least 12 characters.",
  CANNOT_DISABLE_SELF: "You cannot disable your own account.",
};

interface SecretReveal {
  username: string;
  totpSecret: string;
  otpauthUri: string;
}

export function UsersPanel(): JSX.Element {
  const [users, setUsers] = useState<PlatformUserSummary[]>([]);
  const [templates, setTemplates] = useState<RoleTemplateSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<SecretReveal | null>(null);

  const refresh = useCallback(() => {
    listPlatformUsers()
      .then((response) => setUsers(response.users))
      .catch(() => setError("Could not load users."));
  }, []);

  useEffect(() => {
    refresh();
    listRoleTemplates()
      .then((response) => setTemplates(response.templates))
      .catch(() => undefined);
  }, [refresh]);

  const act = useCallback(
    (action: () => Promise<unknown>) => {
      setError(null);
      action()
        .then(refresh)
        .catch((cause: unknown) => {
          const code = cause instanceof Error ? cause.message : "";
          setError(ERROR_MESSAGES[code] ?? "Action failed.");
        });
    },
    [refresh],
  );

  return (
    <section className="users-panel surface-inner" aria-labelledby="users-heading">
      <div className="section-heading">
        <h3 id="users-heading">Users</h3>
        <p>Create accounts and manage access. Authenticator secrets are shown once.</p>
      </div>

      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}

      {reveal ? <SecretRevealPanel reveal={reveal} onDismiss={() => setReveal(null)} /> : null}

      <CreateUserForm
        templates={templates}
        onCreated={(created) => {
          setReveal({
            username: created.user.username,
            totpSecret: created.totp_secret,
            otpauthUri: created.otpauth_uri,
          });
          refresh();
        }}
        onError={(code) => setError(ERROR_MESSAGES[code] ?? "Could not create the user.")}
      />

      <table className="users-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Name</th>
            <th>Role</th>
            <th>Org</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.userId}>
              <td>{user.username}</td>
              <td>{user.displayName}</td>
              <td>{user.persona}</td>
              <td>{user.orgId}</td>
              <td>
                <span className={`status-chip status-chip--${user.status}`}>{user.status}</span>
              </td>
              <td className="users-actions">
                <button
                  type="button"
                  onClick={() =>
                    act(() =>
                      setPlatformUserStatus(
                        user.userId,
                        user.status === "active" ? "disabled" : "active",
                      ),
                    )
                  }
                >
                  {user.status === "active" ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    resetPlatformUserTotp(user.userId)
                      .then((response) =>
                        setReveal({
                          username: user.username,
                          totpSecret: response.totp_secret,
                          otpauthUri: response.otpauth_uri,
                        }),
                      )
                      .catch(() => setError("Could not reset the authenticator."));
                  }}
                >
                  Reset authenticator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const password = window.prompt(
                      `New password for ${user.username} (min 12 characters):`,
                    );
                    if (password) {
                      act(() => resetPlatformUserPassword(user.userId, password));
                    }
                  }}
                >
                  Reset password
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CreateUserForm({
  templates,
  onCreated,
  onError,
}: {
  templates: RoleTemplateSummary[];
  onCreated: (created: CreatedUserSecrets) => void;
  onError: (code: string) => void;
}): JSX.Element {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [template, setTemplate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    setSubmitting(true);
    createPlatformUser({
      username,
      display_name: displayName,
      password,
      role_template: template,
    })
      .then((created) => {
        setUsername("");
        setDisplayName("");
        setPassword("");
        setTemplate("");
        onCreated(created);
      })
      .catch((cause: unknown) => onError(cause instanceof Error ? cause.message : ""))
      .finally(() => setSubmitting(false));
  };

  return (
    <form className="create-user-form" onSubmit={handleSubmit} aria-label="Create user">
      <input
        aria-label="Username"
        placeholder="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        required
      />
      <input
        aria-label="Display name"
        placeholder="Display name"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        required
      />
      <input
        aria-label="Initial password"
        placeholder="Initial password (min 12 chars)"
        type="password"
        autoComplete="new-password"
        minLength={12}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <select
        aria-label="Role template"
        value={template}
        onChange={(event) => setTemplate(event.target.value)}
        required
      >
        <option value="" disabled>
          Role template…
        </option>
        {templates.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}

function SecretRevealPanel({
  reveal,
  onDismiss,
}: {
  reveal: SecretReveal;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <div className="secret-reveal" role="alert">
      <h4>Authenticator secret for {reveal.username}</h4>
      <p>
        Share this with the user over a secure channel and have them add it to their authenticator
        app now. It will not be shown again.
      </p>
      <code>{reveal.totpSecret}</code>
      <code>{reveal.otpauthUri}</code>
      <button type="button" onClick={onDismiss}>
        I have saved it — dismiss
      </button>
    </div>
  );
}
