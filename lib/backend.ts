// Server-side client for the app's backend: a PostgREST data API at /rest and an
// email/password auth API at /auth. Only import from server components and route handlers,
// so the publishable key and session tokens never reach the browser.

// The auth API sets a "__Secure-<prefix>.session_token" cookie.
const SESSION_COOKIE_RE = /(__Secure-[\w-]+\.session_token)=([^;]+)/;

export type Result<T = unknown> = { ok: boolean; status: number; error: string | null; data: T | null };
export type Session = { cookieName: string; token: string };

/** Both variables are injected by the platform into apps that have a backend. */
export function backendConfig() {
  const url = process.env.AMPLIFY_BACKEND_URL?.trim().replace(/\/$/, "");
  const key = process.env.AMPLIFY_BACKEND_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

const notConfigured = <T>(): Result<T> => ({
  ok: false,
  status: 0,
  error: "AMPLIFY_BACKEND_URL / AMPLIFY_BACKEND_PUBLISHABLE_KEY not set",
  data: null,
});

// The backend can suspend when idle, so retry connection failures to ride out a cold start.
async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, { ...init, cache: "no-store" });
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function health(): Promise<Result<string>> {
  const b = backendConfig();
  if (!b) return notConfigured();
  try {
    const res = await fetchRetry(`${b.url}/health`, { headers: { apikey: b.key } });
    const text = await res.text();
    return { ok: res.ok, status: res.status, error: res.ok ? null : text, data: text };
  } catch (e) {
    return { ok: false, status: 0, error: String(e), data: null };
  }
}

async function authPost(path: string, body: object): Promise<Result & { session: Session | null }> {
  const b = backendConfig();
  if (!b) return { ...notConfigured(), session: null };
  try {
    const res = await fetchRetry(`${b.url}/auth${path}`, {
      method: "POST",
      // The auth API rejects requests without an Origin.
      headers: { apikey: b.key, "content-type": "application/json", origin: b.url },
      body: JSON.stringify(body),
    });
    const m = (res.headers.get("set-cookie") || "").match(SESSION_COOKIE_RE);
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      error: res.ok ? null : text,
      data: null,
      session: m ? { cookieName: m[1], token: m[2] } : null,
    };
  } catch (e) {
    return { ok: false, status: 0, error: String(e), data: null, session: null };
  }
}

export const signUp = (email: string, password: string, name: string) =>
  authPost("/sign-up/email", { email, password, name });
export const signIn = (email: string, password: string) => authPost("/sign-in/email", { email, password });

/** Exchange the backend session cookie for a short-lived data API JWT. */
export async function mintJwt(session: Session): Promise<string | null> {
  const b = backendConfig();
  if (!b) return null;
  try {
    const res = await fetchRetry(`${b.url}/auth/token`, {
      headers: { apikey: b.key, cookie: `${session.cookieName}=${session.token}`, origin: b.url },
    });
    if (!res.ok) return null;
    const j = (await res.json().catch(() => null)) as { token?: string } | null;
    return j?.token ?? null;
  } catch {
    return null;
  }
}

/** Decode a JWT payload for display only. It is not verified. */
export function jwtClaims(jwt: string | null): { email?: string; sub?: string } | null {
  if (!jwt) return null;
  try {
    const p = jwt.split(".")[1];
    return JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  } catch {
    return null;
  }
}

type RestOptions = { jwt?: string | null; body?: unknown; prefer?: string };

async function rest<T>(method: string, pathAndQuery: string, opts: RestOptions = {}): Promise<Result<T>> {
  const b = backendConfig();
  if (!b) return notConfigured();
  // Without a JWT the request runs as the anon role.
  const headers: Record<string, string> = { apikey: b.key };
  if (opts.jwt) headers.Authorization = `Bearer ${opts.jwt}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.prefer) headers.Prefer = opts.prefer;
  try {
    const res = await fetchRetry(`${b.url}/rest/${pathAndQuery}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, error: text, data: null };
    return { ok: true, status: res.status, error: null, data: (text ? JSON.parse(text) : null) as T | null };
  } catch (e) {
    return { ok: false, status: 0, error: String(e), data: null };
  }
}

export const select = <T>(table: string, query: string, jwt?: string | null) =>
  rest<T[]>("GET", `${table}?${query}`, { jwt });
export const insert = (table: string, row: object, jwt: string) =>
  rest("POST", table, { jwt, body: row, prefer: "return=minimal" });
export const update = (table: string, filter: string, patch: object, jwt: string) =>
  rest("PATCH", `${table}?${filter}`, { jwt, body: patch, prefer: "return=minimal" });
export const remove = (table: string, filter: string, jwt: string) =>
  rest("DELETE", `${table}?${filter}`, { jwt, prefer: "return=minimal" });

/** Ids from forms and URLs go into query filters, so only accept strict UUIDs. */
export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
