import { backendConfig, health, select } from "./backend";

const SEED_PROJECT_ID = "00000000-0000-4000-8000-000000000001";

// Each check is a read that only succeeds once the named migration has been applied.
const CHECKS = [
  { object: "projects", migration: "20261101000000_create_projects", query: "select=id&limit=1" },
  { object: "tasks", migration: "20261101000100_create_tasks", query: "select=id&limit=1" },
  { object: "comments", migration: "20261101000200_create_comments_and_views", query: "select=id&limit=1" },
  { object: "project_task_counts", migration: "20261101000200_create_comments_and_views", query: "select=project_id&limit=1" },
  { object: "tasks.labels", migration: "20261101000300_add_labels_and_seed", query: "select=labels&limit=1", table: "tasks" },
] as const;

export type SchemaStatus = Awaited<ReturnType<typeof schemaStatus>>;

/** Backend health and migration state, read as the anon role. */
export async function schemaStatus() {
  const h = await health();
  const objects = await Promise.all(
    CHECKS.map(async (c) => {
      const r = await select("table" in c ? c.table : c.object, c.query);
      return {
        object: c.object,
        migration: c.migration,
        present: r.ok,
        httpStatus: r.status,
        error: r.ok ? null : (r.error ?? "").slice(0, 300),
      };
    }),
  );
  const seed = await select<{ id: string }>("projects", `select=id&id=eq.${SEED_PROJECT_ID}`);

  return {
    configured: backendConfig() !== null,
    backend: { reachable: h.ok, httpStatus: h.status },
    objects,
    seedProjectPresent: !!seed.data?.length,
    allMigrationsApplied: objects.every((o) => o.present) && !!seed.data?.length,
  };
}
