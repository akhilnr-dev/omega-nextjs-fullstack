import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid, select } from "@/lib/backend";
import { currentUser, readFlash } from "@/lib/session";
import { Flash } from "../../components";

export const dynamic = "force-dynamic";

type Project = { id: string; name: string; description: string | null; visibility: string; owner_id: string };
type Task = {
  id: string; title: string; status: "todo" | "in_progress" | "done"; priority: string;
  due_date: string | null; labels?: string[]; owner_id: string;
};
type Comment = { id: string; task_id: string; body: string; created_at: string; author_id: string };

const COLUMNS = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
] as const;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const flash = await readFlash();
  const user = await currentUser();
  const here = `/projects/${id}`;

  const projectRes = await select<Project>("projects", `select=*&id=eq.${id}`, user.jwt);
  const project = projectRes.data?.[0];
  if (!project) notFound();

  const tasksRes = await select<Task>("tasks", `select=*&project_id=eq.${id}&order=created_at.asc`, user.jwt);
  const tasks = tasksRes.data ?? [];
  const taskIds = tasks.map((t) => t.id);
  const commentsRes = taskIds.length
    ? await select<Comment>("comments", `select=*&task_id=in.(${taskIds.join(",")})&order=created_at.asc`, user.jwt)
    : { ok: true, data: [] as Comment[] };
  const comments = commentsRes.data ?? [];
  const isOwner = !!user.userId && user.userId === project.owner_id;

  return (
    <>
      <p><Link href="/">← All projects</Link></p>
      <h1 data-testid="project-name">{project.name}</h1>
      {project.description && <p className="sub">{project.description}</p>}
      <p className="sub">Visibility: {project.visibility}{isOwner ? " · You own this project" : ""}</p>

      <Flash flash={flash} />

      {isOwner && (
        <section className="card" aria-labelledby="add-task-heading">
          <h2 id="add-task-heading">Add task</h2>
          <form action="/api/data" method="post" className="inline">
            <input type="hidden" name="intent" value="create-task" />
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="returnTo" value={here} />
            <div className="field"><label htmlFor="t-title">Title</label><input id="t-title" name="title" required maxLength={200} /></div>
            <div className="field">
              <label htmlFor="t-priority">Priority</label>
              <select id="t-priority" name="priority" defaultValue="medium">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div className="field"><label htmlFor="t-due">Due date</label><input id="t-due" name="dueDate" type="date" /></div>
            <div className="field"><label htmlFor="t-labels">Labels (comma separated)</label><input id="t-labels" name="labels" /></div>
            <button type="submit">Add task</button>
          </form>
        </section>
      )}

      {!tasksRes.ok && <p className="flash err">Could not load tasks (HTTP {tasksRes.status}).</p>}

      <section className="columns" aria-label="Tasks by status" style={{ marginTop: 16 }}>
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="card" style={{ marginTop: 0 }} data-testid={`column-${col.status}`}>
              <h2>{col.label} <span className="pill ok">{colTasks.length}</span></h2>
              {colTasks.length === 0 && <p className="empty">Nothing here.</p>}
              {colTasks.map((t) => (
                <article key={t.id} className="task" data-testid="task" data-task-id={t.id}>
                  <strong>{t.title}</strong>
                  <div className="meta">Priority: {t.priority}{t.due_date ? ` · Due ${t.due_date}` : ""}</div>
                  {t.labels && t.labels.length > 0 && (
                    <div className="labels">{t.labels.map((l) => <span key={l} className="label">{l}</span>)}</div>
                  )}

                  {user.userId === t.owner_id && (
                    <form action="/api/data" method="post" className="inline" style={{ marginTop: 6 }}>
                      <input type="hidden" name="intent" value="set-task-status" />
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="returnTo" value={here} />
                      <label htmlFor={`s-${t.id}`}>Status</label>
                      <select id={`s-${t.id}`} name="status" defaultValue={t.status}>
                        {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
                      </select>
                      <button type="submit" className="ghost">Update</button>
                    </form>
                  )}

                  {comments.filter((c) => c.task_id === t.id).map((c) => (
                    <div key={c.id} className="comment" data-testid="comment">{c.body}</div>
                  ))}

                  {user.signedIn && (
                    <form action="/api/data" method="post" className="inline" style={{ marginTop: 6 }}>
                      <input type="hidden" name="intent" value="add-comment" />
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="returnTo" value={here} />
                      <label htmlFor={`c-${t.id}`} className="skip">Comment on {t.title}</label>
                      <input id={`c-${t.id}`} name="body" placeholder="Add a comment" required maxLength={2000} />
                      <button type="submit" className="ghost">Comment</button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          );
        })}
      </section>

      {isOwner && (
        <form action="/api/data" method="post" style={{ marginTop: 16 }}>
          <input type="hidden" name="intent" value="delete-project" />
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="returnTo" value={here} />
          <button type="submit" className="ghost">Delete project</button>
        </form>
      )}
    </>
  );
}
