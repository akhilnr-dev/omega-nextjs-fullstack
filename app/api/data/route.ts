import { NextRequest } from "next/server";
import { insert, isUuid, remove, update } from "@/lib/backend";
import { currentUser, redirectWithFlash, safeReturnTo } from "@/lib/session";

const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;
const VISIBILITIES = ["public", "private"] as const;

const oneOf = <T extends readonly string[]>(v: string, allowed: T, fallback: T[number]): T[number] =>
  (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;

/** All writes go through here as form posts. RLS on the backend is the real authorization. */
export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const intent = String(fd.get("intent") || "");
  const returnTo = safeReturnTo(fd.get("returnTo"));
  const field = (k: string) => String(fd.get(k) || "").trim();

  const { jwt } = await currentUser();
  if (!jwt) return redirectWithFlash(returnTo, "err:Sign in first.");

  const done = (r: { ok: boolean; error: string | null }, okMsg: string) =>
    redirectWithFlash(returnTo, r.ok ? `ok:${okMsg}` : `err:${r.error || "Request failed"}`);

  switch (intent) {
    case "create-project": {
      const name = field("name");
      if (!name) return redirectWithFlash(returnTo, "err:Project name is required.");
      const r = await insert(
        "projects",
        {
          name,
          description: field("description") || null,
          visibility: oneOf(field("visibility"), VISIBILITIES, "private"),
        },
        jwt,
      );
      return done(r, "Project created.");
    }
    case "delete-project": {
      const id = field("projectId");
      if (!isUuid(id)) return redirectWithFlash(returnTo, "err:Invalid project id.");
      const r = await remove("projects", `id=eq.${id}`, jwt);
      return r.ok ? redirectWithFlash("/", "ok:Project deleted.") : done(r, "");
    }
    case "create-task": {
      const projectId = field("projectId");
      const title = field("title");
      if (!isUuid(projectId)) return redirectWithFlash(returnTo, "err:Invalid project id.");
      if (!title) return redirectWithFlash(returnTo, "err:Task title is required.");
      const due = field("dueDate");
      const labels = field("labels")
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 10);
      const r = await insert(
        "tasks",
        {
          project_id: projectId,
          title,
          priority: oneOf(field("priority"), PRIORITIES, "medium"),
          due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
          labels,
        },
        jwt,
      );
      return done(r, "Task added.");
    }
    case "set-task-status": {
      const taskId = field("taskId");
      if (!isUuid(taskId)) return redirectWithFlash(returnTo, "err:Invalid task id.");
      const r = await update("tasks", `id=eq.${taskId}`, { status: oneOf(field("status"), TASK_STATUSES, "todo") }, jwt);
      return done(r, "Task updated.");
    }
    case "delete-task": {
      const taskId = field("taskId");
      if (!isUuid(taskId)) return redirectWithFlash(returnTo, "err:Invalid task id.");
      const r = await remove("tasks", `id=eq.${taskId}`, jwt);
      return done(r, "Task deleted.");
    }
    case "add-comment": {
      const taskId = field("taskId");
      const body = field("body");
      if (!isUuid(taskId)) return redirectWithFlash(returnTo, "err:Invalid task id.");
      if (!body) return redirectWithFlash(returnTo, "err:Comment cannot be empty.");
      const r = await insert("comments", { task_id: taskId, body }, jwt);
      return done(r, "Comment added.");
    }
    default:
      return redirectWithFlash(returnTo, "err:Unknown action.");
  }
}
