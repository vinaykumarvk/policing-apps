import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card } from "@puda/shared";
import { Bilingual } from "./Bilingual";
import { Task } from "./types";

type SortMode = "default" | "overdue_first";

/** Classify a task's SLA status relative to the current time. */
function getSlaStatus(task: Task, now: number, in24h: number): "overdue" | "due_soon" | "on_track" {
  if (!task.sla_due_at) return "on_track";
  const due = new Date(task.sla_due_at).getTime();
  if (due < now) return "overdue";
  if (due < in24h) return "due_soon";
  return "on_track";
}

interface InboxProps {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  feedback?: { variant: "info" | "success" | "warning" | "error"; text: string } | null;
  onTaskClick: (task: Task) => void;
}

export default function Inbox({ tasks, loading, error, feedback, onTaskClick }: InboxProps) {
  const { t } = useTranslation();
  const skeletonItems = [0, 1, 2, 3];
  const [sortMode, setSortMode] = useState<SortMode>("default");

  const now = useMemo(() => Date.now(), [tasks]);
  const in24h = now + 24 * 60 * 60 * 1000;

  const stats = useMemo(() => {
    let overdue = 0, dueSoon = 0, onTrack = 0;
    for (const task of tasks) {
      const status = getSlaStatus(task, now, in24h);
      if (status === "overdue") overdue++;
      else if (status === "due_soon") dueSoon++;
      else onTrack++;
    }
    return { total: tasks.length, overdue, dueSoon, onTrack };
  }, [tasks, now, in24h]);

  /** Tasks sorted by SLA urgency when "overdue first" is active. */
  const sortedTasks = useMemo(() => {
    if (sortMode !== "overdue_first") return tasks;
    const priority: Record<string, number> = { overdue: 0, due_soon: 1, on_track: 2 };
    return [...tasks].sort((a, b) => {
      const pa = priority[getSlaStatus(a, now, in24h)];
      const pb = priority[getSlaStatus(b, now, in24h)];
      if (pa !== pb) return pa - pb;
      // Within same bucket, soonest-due first
      const da = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Infinity;
      const db = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Infinity;
      return da - db;
    });
  }, [tasks, sortMode, now, in24h]);

  return (
    <section className="panel">
      {feedback ? <Alert variant={feedback.variant}>{feedback.text}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {!loading && !error && tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <h3>{t("inbox.no_tasks")}</h3>
          <p>{t("inbox.no_tasks_desc")}</p>
        </div>
      ) : null}

      {tasks.length > 0 && (
        <>
          <div className="workload-stats">
            <div className="workload-stats__card workload-stats__card--total">
              <span className="workload-stats__count">{stats.total}</span>
              <span className="workload-stats__label"><Bilingual tKey="dashboard.total_pending" /></span>
            </div>
            <div className="workload-stats__card workload-stats__card--overdue">
              <span className="workload-stats__count">{stats.overdue}</span>
              <span className="workload-stats__label"><Bilingual tKey="dashboard.overdue" /></span>
            </div>
            <div className="workload-stats__card workload-stats__card--due-soon">
              <span className="workload-stats__count">{stats.dueSoon}</span>
              <span className="workload-stats__label"><Bilingual tKey="dashboard.due_soon" /></span>
            </div>
            <div className="workload-stats__card workload-stats__card--on-track">
              <span className="workload-stats__count">{stats.onTrack}</span>
              <span className="workload-stats__label"><Bilingual tKey="dashboard.on_track" /></span>
            </div>
          </div>
          <div className="inbox-sort-bar">
            <Button
              type="button"
              variant={sortMode === "overdue_first" ? "primary" : "ghost"}
              className="inbox-sort-btn"
              aria-pressed={sortMode === "overdue_first"}
              onClick={() => setSortMode(sortMode === "overdue_first" ? "default" : "overdue_first")}
            >
              {t("inbox.sort_overdue_first")}
            </Button>
          </div>
        </>
      )}

      {loading ? (
        <ul className="task-list officer-skeleton-list" aria-label={t("inbox.loading")}>
          {skeletonItems.map((idx) => (
            <li key={idx}>
              <Card className="task-card-wrap task-card-skeleton" aria-hidden="true">
                <div className="skeleton skeleton-task-title" />
                <div className="skeleton skeleton-task-line" />
                <div className="skeleton skeleton-task-line short" />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="task-list">
          {sortedTasks.map((task) => {
            const slaStatus = getSlaStatus(task, now, in24h);
            return (
              <li key={task.task_id}>
                <Card className="task-card-wrap">
                  <Button type="button" variant="ghost" className="task-card" onClick={() => onTaskClick(task)}>
                    <div>
                      <h2>
                        {t("inbox.arn_label", { arn: task.arn })}
                        {slaStatus === "overdue" && (
                          <span className="sla-badge sla-badge--overdue">{t("inbox.overdue")}</span>
                        )}
                        {slaStatus === "due_soon" && (
                          <span className="sla-badge sla-badge--due-soon">{t("inbox.due_soon")}</span>
                        )}
                        {slaStatus === "on_track" && task.sla_due_at && (
                          <span className="sla-badge sla-badge--on-track">{t("inbox.on_track")}</span>
                        )}
                      </h2>
                      <p>
                        {t("inbox.service")}:{" "}
                        {task.service_key
                          ?.replace(/_/g, " ")
                          .replace(/\b\w/g, (l: string) => l.toUpperCase()) || "\u2014"}
                      </p>
                      {task.applicant_name && <p>{t("inbox.applicant")}: {task.applicant_name}</p>}
                      <p>
                        {t("inbox.stage")}: {task.state_id} | {t("inbox.required_role")}: {task.system_role_id}
                      </p>
                      {task.sla_due_at && (
                        <p className={slaStatus === "overdue" ? "sla-overdue" : ""}>
                          {t("inbox.sla_due")}: {new Date(task.sla_due_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <span className="badge">{task.status}</span>
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
