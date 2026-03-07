import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Badge } from "@puda/shared";
import { apiBaseUrl, Task } from "../types";

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

export default function TaskInbox({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    fetch(`${apiBaseUrl}/api/v1/tasks/inbox`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => setTasks(data.tasks || data || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load tasks"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline]);

  return (
    <>
      <div className="page__header">
        <h1>{t("inbox.title")}</h1>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {loading ? (
        <div className="loading-center">{t("common.loading")}</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state"><h3>{t("inbox.no_tasks")}</h3></div>
      ) : (
        <table className="entity-table">
          <thead>
            <tr>
              <th>{t("inbox.entity")}</th>
              <th>{t("inbox.role")}</th>
              <th>{t("inbox.status")}</th>
              <th>{t("inbox.sla")}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.task_id}>
                <td data-label={t("inbox.entity")}>{task.entity_type} / {task.entity_id}</td>
                <td data-label={t("inbox.role")}>{task.role_id}</td>
                <td data-label={t("inbox.status")}><span className="badge badge--default">{task.status}</span></td>
                <td data-label={t("inbox.sla")}>
                  {task.sla_due_at ? (
                    <>
                      <Badge variant={
                        new Date(task.sla_due_at) < new Date() ? "danger" :
                        new Date(task.sla_due_at).getTime() - Date.now() < 86400000 ? "warning" : "success"
                      }>
                        {new Date(task.sla_due_at) < new Date() ? t("sla.breached") :
                         new Date(task.sla_due_at).getTime() - Date.now() < 86400000 ? t("sla.at_risk") : t("sla.on_track")}
                      </Badge>
                      {" "}{new Date(task.sla_due_at).toLocaleDateString()}
                    </>
                  ) : (
                    <Badge variant="neutral">{t("sla.no_sla")}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
