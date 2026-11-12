import type { SchemaStatus } from "@/lib/schemaStatus";

export function Flash({ flash }: { flash: { ok: boolean; message: string } | null }) {
  if (!flash) return null;
  return (
    <div role="status" data-testid="flash" className={`flash ${flash.ok ? "ok" : "err"}`}>
      {flash.message}
    </div>
  );
}

export function StatusPill({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return <span className={`pill ${ok ? "ok" : warn ? "warn" : "err"}`}>{label}</span>;
}

// 42501 means the object exists but the API role has no GRANT on it.
function stateLabel(httpStatus: number, error: string | null): string {
  if (error?.includes('"42501"')) return `No grant (HTTP ${httpStatus})`;
  if (httpStatus === 0) return "Unreachable";
  return `Missing (HTTP ${httpStatus})`;
}

export function BackendStatusCard({ status }: { status: SchemaStatus }) {
  const backendLabel = !status.configured
    ? "Not configured"
    : status.backend.reachable
      ? "Healthy"
      : `Unreachable (HTTP ${status.backend.httpStatus})`;

  return (
    <section className="card" aria-labelledby="backend-heading" data-testid="backend-status">
      <h2 id="backend-heading">
        Backend
        <StatusPill ok={status.backend.reachable} label={backendLabel} />
        <StatusPill
          ok={status.allMigrationsApplied}
          label={status.allMigrationsApplied ? "All migrations applied" : "Migrations not applied"}
        />
      </h2>
      <table>
        <thead>
          <tr><th scope="col">Object</th><th scope="col">Created by migration</th><th scope="col">State</th></tr>
        </thead>
        <tbody>
          {status.objects.map((o) => (
            <tr key={o.object} data-testid={`schema-object-${o.object}`} data-present={o.present}>
              <td><code>{o.object}</code></td>
              <td><code>{o.migration}</code></td>
              <td>
                <StatusPill ok={o.present} label={o.present ? "Present" : stateLabel(o.httpStatus, o.error)} />
                {o.error && <div className="sub"><code>{o.error}</code></div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
