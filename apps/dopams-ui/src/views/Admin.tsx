import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, useToast } from "@puda/shared";
import { apiBaseUrl, UserAccount } from "../types";

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

export default function Admin({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create user form
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const loadUsers = () => {
    fetch(`${apiBaseUrl}/api/v1/users`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => setUsers(data.users || data || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    loadUsers();
  }, [authHeaders, isOffline]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/users`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          username: newUsername,
          full_name: newFullName,
          email: newEmail,
          phone: newPhone,
          password: newPassword,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("admin.user_created_success"));
      setShowForm(false);
      setNewUsername(""); setNewFullName(""); setNewEmail(""); setNewPhone(""); setNewPassword("");
      loadUsers();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <h1>{t("admin.title")}</h1>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="admin-section">
        <div className="admin-section__header">
          <h2>{t("admin.users")}</h2>
          <Button onClick={() => setShowForm(!showForm)} disabled={isOffline}>
            {showForm ? t("common.cancel") : t("admin.create_user")}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleCreateUser} className="detail-section" style={{ marginBottom: "var(--space-4)" }}>
            <div className="detail-grid">
              <Field label={t("admin.username")} htmlFor="new-username" required>
                <Input id="new-username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
              </Field>
              <Field label={t("admin.full_name")} htmlFor="new-fullname" required>
                <Input id="new-fullname" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} required />
              </Field>
              <Field label={t("admin.email")} htmlFor="new-email">
                <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </Field>
              <Field label={t("admin.phone")} htmlFor="new-phone">
                <Input id="new-phone" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </Field>
              <Field label={t("login.password")} htmlFor="new-password" required>
                <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </Field>
            </div>
            <div style={{ marginTop: "var(--space-3)" }}>
              <Button type="submit" disabled={creating}>{creating ? t("common.loading") : t("common.create")}</Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="loading-center">{t("common.loading")}</div>
        ) : users.length === 0 ? (
          <div className="empty-state"><h3>{t("admin.no_users")}</h3></div>
        ) : (
          <table className="entity-table">
            <thead>
              <tr>
                <th>{t("admin.username")}</th>
                <th>{t("admin.full_name")}</th>
                <th>{t("admin.email")}</th>
                <th>{t("admin.active")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td data-label={t("admin.username")}>{u.username}</td>
                  <td data-label={t("admin.full_name")}>{u.full_name}</td>
                  <td data-label={t("admin.email")}>{u.email || "—"}</td>
                  <td data-label={t("admin.active")}><span className={`badge badge--${u.is_active ? "success" : "default"}`}>{u.is_active ? t("common.yes") : t("common.no")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
