import Link from "next/link";
import { select } from "@/lib/backend";
import { schemaStatus } from "@/lib/schemaStatus";
import { currentUser, readFlash } from "@/lib/session";
import { BackendStatusCard, Flash, StatusPill } from "./components";

export const dynamic = "force-dynamic";

type Project = { id: string; name: string; description: string | null; visibility: "public" | "private"; owner_id: string };
type Counts = { project_id: string; total: number; todo: number; in_progress: number; done: number };

export default async function Home({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const isSignup = (await searchParams).mode === "signup";
  const flash = await readFlash();
  const [status, user] = await Promise.all([schemaStatus(), currentUser()]);

  const projects = await select<Project>("projects", "select=id,name,description,visibility,owner_id&order=created_at.desc", user.jwt);
  const counts = await select<Counts>("project_task_counts", "select=*", user.jwt);
  const countsById = new Map((counts.data ?? []).map((c) => [c.project_id, c]));

  return (
    <>
      <header>
        <h1>Omega Tracker</h1>
        <p className="sub">Projects, tasks and comments stored in a Postgres backend created by the app&apos;s migrations.</p>
      </header>

      <Flash flash={flash} />
      <BackendStatusCard status={status} />

      <section className="card" aria-labelledby="account-heading" data-testid="account">
        <h2 id="account-heading">
          Account <StatusPill ok={user.signedIn} warn label={user.signedIn ? "Signed in" : "Anonymous"} />
        </h2>
        {user.signedIn ? (
          <form action="/api/auth" method="post" className="inline">
            <span>
              Signed in as <strong data-testid="signed-in-email">{user.claims?.email ?? user.userId}</strong>
            </span>
            <input type="hidden" name="intent" value="signout" />
            <button className="ghost" type="submit">Sign out</button>
          </form>
        ) : (
          <>
            <p className="sub">
              {isSignup ? <Link href="/">Have an account? Sign in</Link> : <Link href="/?mode=signup">New here? Create an account</Link>}
            </p>
            <form action="/api/auth" method="post" className="inline" aria-label={isSignup ? "Sign up" : "Sign in"}>
              <input type="hidden" name="intent" value={isSignup ? "signup" : "signin"} />
              {isSignup && (
                <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" autoComplete="name" /></div>
              )}
              <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
              <div className="field">
                <label htmlFor="password">Password (8+ characters)</label>
                <input id="password" name="password" type="password" required minLength={8} autoComplete={isSignup ? "new-password" : "current-password"} />
              </div>
              <button type="submit">{isSignup ? "Create account" : "Sign in"}</button>
            </form>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="projects-heading" data-testid="projects">
        <h2 id="projects-heading">Projects</h2>
        {user.signedIn && (
          <form action="/api/data" method="post" className="inline" aria-label="Create project" style={{ marginBottom: 12 }}>
            <input type="hidden" name="intent" value="create-project" />
            <input type="hidden" name="returnTo" value="/" />
            <div className="field"><label htmlFor="p-name">Name</label><input id="p-name" name="name" required maxLength={100} /></div>
            <div className="field"><label htmlFor="p-desc">Description</label><input id="p-desc" name="description" maxLength={1000} /></div>
            <div className="field">
              <label htmlFor="p-vis">Visibility</label>
              <select id="p-vis" name="visibility" defaultValue="private">
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
            <button type="submit">Create project</button>
          </form>
        )}
        {!projects.ok ? (
          <p className="flash err" data-testid="projects-error">Could not load projects (HTTP {projects.status}). Have the migrations been applied?</p>
        ) : (projects.data ?? []).length === 0 ? (
          <p className="empty">No projects yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Visibility</th><th scope="col">To do</th><th scope="col">In progress</th><th scope="col">Done</th></tr>
            </thead>
            <tbody>
              {(projects.data ?? []).map((p) => {
                const c = countsById.get(p.id);
                return (
                  <tr key={p.id} data-testid="project-row" data-project-id={p.id}>
                    <td>
                      <Link href={`/projects/${p.id}`}>{p.name}</Link>
                      {p.description && <div className="sub" style={{ margin: 0 }}>{p.description}</div>}
                    </td>
                    <td>{p.visibility}</td>
                    <td>{c?.todo ?? 0}</td>
                    <td>{c?.in_progress ?? 0}</td>
                    <td>{c?.done ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
