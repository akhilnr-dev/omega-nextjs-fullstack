import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtClaims, mintJwt, type Session } from "./backend";

// The app keeps the backend session in its own HttpOnly cookie, as "<cookieName>|<token>".
export const APP_SESSION_COOKIE = "app_session";
const FLASH_COOKIE = "flash";

export function encodeSession(s: Session): string {
  return `${s.cookieName}|${s.token}`;
}

async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(APP_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const i = raw.indexOf("|");
  if (i <= 0) return null;
  return { cookieName: raw.slice(0, i), token: raw.slice(i + 1) };
}

export async function currentUser() {
  const session = await readSession();
  const jwt = session ? await mintJwt(session) : null;
  const claims = jwtClaims(jwt);
  return { jwt, claims, signedIn: !!jwt, userId: claims?.sub ?? null };
}

/** Read and display the short-lived flash message ("ok:..." or "err:..."). */
export async function readFlash(): Promise<{ ok: boolean; message: string } | null> {
  const v = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!v) return null;
  return { ok: v.startsWith("ok:"), message: v.slice(3) };
}

/** Only allow same-site relative paths, to avoid an open redirect. */
export function safeReturnTo(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : "/";
}

/**
 * 303 redirect to a RELATIVE path so the browser keeps its current host. Feedback goes in a
 * flash cookie instead of the query string.
 */
export function redirectWithFlash(to: string, flash?: string, extra?: (res: NextResponse) => void) {
  const res = new NextResponse(null, { status: 303, headers: { Location: to } });
  if (flash) res.cookies.set(FLASH_COOKIE, flash.slice(0, 200), { path: "/", maxAge: 10 });
  extra?.(res);
  return res;
}
